"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { flushSyncQueue } from "@/lib/syncQueue";
import { processPendingDownloads } from "@/lib/offlineCache";
import { useToast } from "@/context/ToastProvider";

const OnlineStatusContext = createContext<{ isOnline: boolean }>({ isOnline: true });

export function OnlineStatusProvider({ children }: { children: React.ReactNode }) {
  const pushToast = useToast();
  const [isOnline, setIsOnline] = useState(true);

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
