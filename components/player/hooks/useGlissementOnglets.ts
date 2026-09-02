"use client";

import { useRef } from "react";

/**
 * Passer d'un onglet à l'autre en glissant le doigt.
 *
 * La barre d'onglets reste le moyen sûr d'y aller directement ; ce geste
 * est le raccourci qu'on attend d'une pile d'onglets sur un téléphone, et
 * qui manquait.
 *
 * Deux précautions, sans lesquelles il gênerait plus qu'il n'aide :
 *
 * - **Intention horizontale exigée.** Les paroles défilent verticalement
 *   dans le même espace : un glissement doit être franchement latéral
 *   pour compter, sinon un défilement un peu oblique changerait d'onglet
 *   au milieu d'un couplet.
 * - **Zones à défilement propre écartées.** Une rangée qui défile déjà de
 *   côté — des titres similaires, par exemple — garde son geste. Il suffit
 *   de poser `data-glissement-ignore` dessus.
 */

/** En dessous, c'est une hésitation, pas un geste. */
const DISTANCE_MIN = 60;

/** Le mouvement doit être nettement plus horizontal que vertical. */
const RAPPORT_MIN = 1.5;

export function useGlissementOnglets(onChange: (direction: 1 | -1) => void) {
  const depart = useRef<{ x: number; y: number; ignore: boolean } | null>(null);

  return {
    onTouchStart(e: React.TouchEvent) {
      const cible = e.target as HTMLElement | null;
      depart.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        ignore: Boolean(cible?.closest("[data-glissement-ignore]")),
      };
    },

    onTouchEnd(e: React.TouchEvent) {
      const debut = depart.current;
      depart.current = null;
      if (!debut || debut.ignore) return;

      const dx = e.changedTouches[0].clientX - debut.x;
      const dy = e.changedTouches[0].clientY - debut.y;

      if (Math.abs(dx) < DISTANCE_MIN) return;
      if (Math.abs(dx) < Math.abs(dy) * RAPPORT_MIN) return;

      // Glisser vers la gauche fait venir l'onglet suivant, comme une page
      // qu'on pousse hors de l'écran.
      onChange(dx < 0 ? 1 : -1);
    },

    onTouchCancel() {
      depart.current = null;
    },
  };
}
