"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PlayableSong } from "@/context/PlayerProvider";
import { useToast } from "@/context/ToastProvider";
import { useOnlineStatus } from "@/context/OnlineStatusProvider";
import { HorsLigneReserve } from "@/lib/offlineAcces";
import {
  downloadSongForOffline,
  isSongOffline,
  queuePendingDownload,
  removeOfflineSong,
} from "@/lib/offlineCache";

/**
 * Télécharger un titre, depuis n'importe où.
 *
 * La même quinzaine de lignes vivait en quatre exemplaires — menu
 * contextuel, mini-lecteur, lecteur plein écran, fiche du titre. Les
 * poser maintenant sur chaque pochette et chaque ligne de liste en
 * aurait fait dix. Une divergence entre deux copies ne se voit pas :
 * elle se découvre le jour où l'un des boutons cesse de faire ce que
 * l'autre fait.
 *
 * TROIS CAS, ET AUCUN N'EST UNE PANNE
 *
 * - **Déjà téléchargé** : on retire.
 * - **Hors réseau** : on met en file, le téléchargement partira au
 *   retour de la connexion.
 * - **Pas abonné** : le hors-ligne est réservé au Premium, et le
 *   garde-fou vit dans `lib/offlineCache.ts` — tous les chemins y
 *   passent. On ne masque pas le bouton pour autant : on emmène vers
 *   l'abonnement. Un bouton visible qui explique vaut mieux qu'un bouton
 *   absent qui laisse croire que la fonction n'existe pas.
 *
 * L'état est relu à chaque changement du cache hors-ligne : télécharger
 * depuis le lecteur doit allumer la pastille de la carte restée à
 * l'écran derrière.
 */
export type EtatTelechargement = "absent" | "present" | "encours";

export function useTelechargementHorsLigne(song: PlayableSong | null): {
  etat: EtatTelechargement;
  basculer: () => void;
} {
  const router = useRouter();
  const pushToast = useToast();
  const { isOnline } = useOnlineStatus();
  const [etat, setEtat] = useState<EtatTelechargement>("absent");

  const id = song?._id ?? null;

  useEffect(() => {
    if (!id) return;
    let vivant = true;
    const relire = () => {
      void isSongOffline(id)
        .then((present) => {
          // On n'écrase pas un téléchargement en cours : il finira par
          // basculer sur « present » tout seul.
          if (vivant) setEtat((actuel) => (actuel === "encours" ? actuel : present ? "present" : "absent"));
        })
        .catch(() => undefined);
    };
    relire();
    window.addEventListener("moziik-offline-change", relire);
    return () => {
      vivant = false;
      window.removeEventListener("moziik-offline-change", relire);
    };
  }, [id]);

  const basculer = useCallback(() => {
    if (!song) return;

    void (async () => {
      const resume = {
        _id: song._id,
        title: song.title,
        coverUrl: song.coverUrl,
        audioUrl: song.audioUrl,
        duration: song.duration,
        artist: song.artist ?? { _id: "", stageName: "Artiste supprimé" },
      };

      try {
        if (etat === "present") {
          await removeOfflineSong(song._id);
          setEtat("absent");
          pushToast("success", "Retiré des téléchargements.");
          return;
        }
        if (etat === "encours") return;

        setEtat("encours");

        if (!isOnline) {
          await queuePendingDownload(resume);
          setEtat("absent");
          pushToast("info", "En attente — le téléchargement partira à la reconnexion.");
          return;
        }

        await downloadSongForOffline(resume);
        setEtat("present");
        pushToast("success", `« ${song.title} » est disponible hors connexion.`);
      } catch (err) {
        setEtat("absent");
        if (err instanceof HorsLigneReserve) {
          pushToast("info", "Le téléchargement est réservé aux abonnés Premium.");
          router.push("/abonnement");
          return;
        }
        pushToast("error", err instanceof Error ? err.message : "Le téléchargement a échoué.");
      }
    })();
  }, [etat, isOnline, pushToast, router, song]);

  return { etat, basculer };
}

/** Variante playlist/album : même garde-fou, même façon de le dire. */
export function useTelechargementLot(): {
  enCours: boolean;
  lancer: (nom: string, telecharger: () => Promise<void>) => void;
} {
  const router = useRouter();
  const pushToast = useToast();
  const [enCours, setEnCours] = useState(false);

  const lancer = useCallback(
    (nom: string, telecharger: () => Promise<void>) => {
      if (enCours) return;
      setEnCours(true);
      void telecharger()
        .then(() => pushToast("success", `« ${nom} » est disponible hors connexion.`))
        .catch((err) => {
          if (err instanceof HorsLigneReserve) {
            pushToast("info", "Le téléchargement est réservé aux abonnés Premium.");
            router.push("/abonnement");
            return;
          }
          pushToast("error", err instanceof Error ? err.message : "Le téléchargement a échoué.");
        })
        .finally(() => setEnCours(false));
    },
    [enCours, pushToast, router]
  );

  return { enCours, lancer };
}
