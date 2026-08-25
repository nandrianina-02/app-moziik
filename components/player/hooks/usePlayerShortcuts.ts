"use client";

import { useEffect } from "react";
import { usePlayer } from "@/context/PlayerProvider";

/**
 * Raccourcis clavier du lecteur.
 *
 * Deux portées, volontairement distinctes :
 *
 * - « global » : actif partout dans l'application. On s'y limite à des
 *   touches qui ne servent à rien d'autre pendant la navigation (Espace,
 *   N, P, M, F). Les flèches en sont exclues : les capturer partout
 *   empêcherait de faire défiler les pages au clavier, ce qui est bien
 *   plus gênant que pratique.
 *
 * - « plein-écran » : le lecteur occupe l'écran, on peut alors ajouter
 *   les flèches (navigation dans le morceau et volume) sans rien voler à
 *   la page qui est derrière.
 *
 * Dans les deux cas, rien ne se déclenche pendant une saisie : chercher
 * un titre, écrire un commentaire ou remplir un formulaire ne doit jamais
 * mettre la musique en pause.
 */

const PAS_SEEK_S = 5;
const PAS_VOLUME = 0.05;

function saisieEnCours(cible: EventTarget | null): boolean {
  const el = cible as HTMLElement | null;
  if (!el) return false;
  const balise = el.tagName;
  return (
    balise === "INPUT" ||
    balise === "TEXTAREA" ||
    balise === "SELECT" ||
    el.isContentEditable ||
    // Un curseur (barre de progression, volume) gère déjà ses propres flèches.
    el.getAttribute("role") === "slider"
  );
}

export function usePlayerShortcuts({ pleinEcran = false }: { pleinEcran?: boolean } = {}) {
  const {
    currentSong,
    togglePlay,
    playNext,
    playPrevious,
    seek,
    progress,
    duration,
    volume,
    setVolume,
    openFullPlayer,
    closeFullPlayer,
    isFullPlayerOpen,
  } = usePlayer();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!currentSong) return;
      // Le lecteur plein écran monte sa propre instance, plus complète.
      // Sans cette garde, les deux répondraient à la même touche : « F »
      // ouvrirait puis refermerait le lecteur dans la même frappe.
      if (isFullPlayerOpen && !pleinEcran) return;
      if (saisieEnCours(e.target)) return;
      // Laisse passer les raccourcis système et navigateur.
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case " ":
        case "k":
        case "K":
          e.preventDefault();
          togglePlay();
          return;
        case "n":
        case "N":
          e.preventDefault();
          playNext();
          return;
        case "p":
        case "P":
          e.preventDefault();
          playPrevious();
          return;
        case "m":
        case "M":
          e.preventDefault();
          // Le volume précédent n'est pas mémorisé côté lecteur : couper
          // ramène à 0, rétablir remet le maximum — comportement des
          // lecteurs web usuels.
          setVolume(volume > 0 ? 0 : 1);
          return;
        case "f":
        case "F":
          e.preventDefault();
          if (isFullPlayerOpen) closeFullPlayer();
          else openFullPlayer();
          return;
      }

      if (!pleinEcran) return;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          seek(Math.max(0, progress - (e.shiftKey ? PAS_SEEK_S * 6 : PAS_SEEK_S)));
          return;
        case "ArrowRight":
          e.preventDefault();
          seek(Math.min(duration, progress + (e.shiftKey ? PAS_SEEK_S * 6 : PAS_SEEK_S)));
          return;
        case "ArrowUp":
          e.preventDefault();
          setVolume(Math.min(1, volume + PAS_VOLUME));
          return;
        case "ArrowDown":
          e.preventDefault();
          setVolume(Math.max(0, volume - PAS_VOLUME));
          return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    currentSong,
    togglePlay,
    playNext,
    playPrevious,
    seek,
    progress,
    duration,
    volume,
    setVolume,
    openFullPlayer,
    closeFullPlayer,
    isFullPlayerOpen,
    pleinEcran,
  ]);
}
