"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { flushSyncQueue } from "@/lib/syncQueue";
import { processPendingDownloads } from "@/lib/offlineCache";
import { confirmerCompteMemorise, definirCompte, installerCacheApi, oublierCompte } from "@/lib/offlineApi";
import { useToast } from "@/context/ToastProvider";

// Posé à l'évaluation du module, donc avant le premier rendu : un effet
// s'exécuterait après les requêtes lancées au montage des pages, qui
// échapperaient alors au cache.
installerCacheApi();

const OnlineStatusContext = createContext<{ isOnline: boolean }>({ isOnline: true });

export function OnlineStatusProvider({ children }: { children: React.ReactNode }) {
  const pushToast = useToast();
  const { data: session, status } = useSession();
  const [isOnline, setIsOnline] = useState(true);

  // Les entrées du cache sont préfixées par le compte.
  //
  // Purger demande deux garanties, pas une : que l'on ait VU une session
  // authentifiée auparavant — une absence de session au démarrage n'est pas
  // une déconnexion — et que le réseau réponde, puisque hors-ligne NextAuth
  // rapporte « unauthenticated » faute de pouvoir joindre son endpoint.
  // Sans la première, un simple raté d'authentification vidait tout le
  // cache ; c'est ce qui s'est produit pendant la mise au point.
  const etaitConnecte = useRef(false);
  useEffect(() => {
    if (status === "loading") return;
    if (status === "authenticated" && session?.user?.id) {
      etaitConnecte.current = true;
      definirCompte(session.user.id);
      return;
    }
    if (!navigator.onLine) {
      // Sans réseau, « pas de session » ne veut rien dire : on garde le
      // compte mémorisé, sinon le cache devient introuvable.
      confirmerCompteMemorise();
      return;
    }
    if (etaitConnecte.current) {
      etaitConnecte.current = false;
      oublierCompte();
      return;
    }
    // Visiteur non connecté : ses consultations méritent aussi d'être
    // disponibles hors-ligne, sous une clé qui leur est propre.
    definirCompte(null);
  }, [session?.user?.id, status]);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    async function handleOnline() {
      setIsOnline(true);
      // Synchronisation intelligente : on ne renvoie que les actions en
      // attente, jamais toute la bibliothèque.
      const { synced } = await flushSyncQueue();
      if (synced > 0) {
        pushToast("success", `${synced} action(s) synchronisée(s).`);
      }
      const downloaded = await processPendingDownloads();
      if (downloaded > 0) {
        pushToast("success", `${downloaded} téléchargement(s) en attente lancé(s).`);
      }
    }
    function handleOffline() {
      setIsOnline(false);
      pushToast("info", "Tu es hors-ligne. Tes actions seront synchronisées au retour du réseau.");
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Tentative de synchro au chargement, au cas où des actions
    // seraient restées en attente d'une session précédente.
    if (navigator.onLine) {
      flushSyncQueue();
      processPendingDownloads();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <OnlineStatusContext.Provider value={{ isOnline }}>{children}</OnlineStatusContext.Provider>;
}

export const useOnlineStatus = () => useContext(OnlineStatusContext);
