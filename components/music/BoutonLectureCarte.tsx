"use client";

import { useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { usePlayer, type PlayableSong, type PlaySource } from "@/context/PlayerProvider";
import { useToast } from "@/context/ToastProvider";

/**
 * Le bouton de lecture posé sur une pochette (titre, album, playlist) : il
 * monte du bas de la pochette au survol de la carte, comme sur Spotify, et
 * reste visible sur écran tactile, où il n'y a pas de survol, ainsi que
 * pendant la lecture de ce qu'il représente.
 *
 * `titres` est une liste, ou une fonction qui la charge au premier appui :
 * une carte d'album ne connaît pas ses titres, et les demander pour chaque
 * carte affichée coûterait une requête par vignette.
 */
export function BoutonLectureCarte({
  titres,
  source,
  depart = 0,
  enCours,
  libelle,
}: {
  titres: PlayableSong[] | (() => Promise<PlayableSong[]>);
  source: PlaySource;
  depart?: number;
  /** Ce que la carte représente est en cours de lecture (pause possible). */
  enCours: boolean;
  libelle: string;
}) {
  const { playQueue, togglePlay, isPlaying } = usePlayer();
  const pushToast = useToast();
  const [chargement, setChargement] = useState(false);
  const joue = enCours && isPlaying;

  async function lancer(e: React.MouseEvent | React.KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (enCours) {
      togglePlay();
      return;
    }
    if (typeof titres !== "function") {
      playQueue(titres, depart, source);
      return;
    }
    setChargement(true);
    try {
      const liste = await titres();
      if (liste.length === 0) pushToast("info", "Aucun titre à écouter ici.");
      else playQueue(liste, depart, source);
    } catch {
      pushToast("error", "La lecture n'a pas pu démarrer.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={joue ? `Mettre en pause ${libelle}` : `Écouter ${libelle}`}
      onClick={lancer}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && lancer(e)}
      className={`absolute bottom-2 right-2 z-10 grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-accent text-base shadow-[0_8px_16px_rgba(0,0,0,0.35)] transition-all duration-200 hover:scale-105 hover:bg-accent-hover ${
        enCours
          ? "translate-y-0 opacity-100"
          : "opacity-100 [@media(hover:hover)]:translate-y-2 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:translate-y-0 [@media(hover:hover)]:group-focus-within:opacity-100"
      }`}
    >
      {chargement ? (
        <Loader2 size={18} className="animate-spin" />
      ) : joue ? (
        <Pause size={18} fill="currentColor" />
      ) : (
        <Play size={18} fill="currentColor" className="translate-x-px" />
      )}
    </span>
  );
}
