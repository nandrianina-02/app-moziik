"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Vrai quand la media query correspond.
 *
 * Sert là où deux mises en page ne peuvent pas se contenter de
 * `hidden lg:flex` : afficher les deux et n'en masquer qu'une laisse les
 * DEUX montées. Dans le lecteur plein écran, cela signifiait deux barres
 * d'onglets (donc deux `role="tablist"` et deux animations partageant le
 * même `layoutId`), deux panneaux « Titres similaires » et deux sections
 * de commentaires — soit le double des requêtes pour un seul écran visible.
 *
 * `useSyncExternalStore` plutôt qu'un `useEffect` : la valeur est correcte
 * dès le premier rendu client, sans image intermédiaire. Le repli serveur
 * renvoie `false`, ce qui est sans conséquence ici — les composants qui
 * l'utilisent n'existent qu'après une interaction.
 */
export function useMediaQuery(requete: string): boolean {
  const abonner = useCallback(
    (relancer: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => undefined;
      const mql = window.matchMedia(requete);
      mql.addEventListener("change", relancer);
      return () => mql.removeEventListener("change", relancer);
    },
    [requete]
  );

  const lire = useCallback(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(requete).matches;
  }, [requete]);

  return useSyncExternalStore(abonner, lire, () => false);
}
