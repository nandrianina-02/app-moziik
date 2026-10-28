"use client";

import { useState } from "react";
import { usePlayer, type PlayableSong } from "@/context/PlayerProvider";
import { useToast } from "@/context/ToastProvider";
import { useUnivers } from "@/context/UniversProvider";
import { useMode } from "@/context/ModeProvider";

/**
 * « Ma bande son » : la compilation du visiteur, lancée d'un geste.
 *
 * Elle joue vraiment : elle interroge /api/station, la même station que la
 * page Radio, et lance la file. Elle marche sans compte : /api/station
 * répond aussi à un visiteur anonyme, avec une sélection générique.
 *
 * La file n'est pas préchargée : plusieurs dizaines de titres réclamés à
 * chaque visite, pour un bouton que la plupart ne touchent pas, coûteraient
 * plus cher que l'attente d'un clic.
 */
type Reponse = {
  songs: PlayableSong[];
  personnalisee: boolean;
  presentation?: { nom: string; intro: string };
};

export function useBandeSon() {
  const { playQueue } = usePlayer();
  const pushToast = useToast();
  const { mode } = useMode();
  const { univers } = useUnivers();
  const [chargement, setChargement] = useState(false);

  async function lancer() {
    if (chargement) return;
    setChargement(true);
    try {
      const res = await fetch(`/api/station?heure=${new Date().getHours()}&mode=${mode}&univers=${univers}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as Reponse;
      if (!data.songs?.length) {
        pushToast("info", "Pas encore assez d'écoutes pour composer une sélection.");
        return;
      }
      playQueue(data.songs, 0, {
        type: "radio",
        label: data.presentation?.nom ?? "Ma bande son",
        // Marque la file comme station : la suite se demande à /api/station,
        // sinon elle cesserait d'être personnalisée au bout du premier tour.
        station: true,
      });
    } catch {
      pushToast("error", "La sélection n'a pas pu être chargée.");
    } finally {
      setChargement(false);
    }
  }

  return { lancer, chargement };
}
