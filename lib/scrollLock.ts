"use client";

import { useEffect } from "react";

/**
 * Verrou de défilement du corps, à compteur de références.
 *
 * Chaque surcouche posait auparavant son propre
 * `document.body.style.overflow = "hidden"` en mémorisant la valeur
 * précédente. Deux surcouches empilées (le lecteur plein écran puis la
 * modale de partage qu'il ouvre) se marchaient dessus : la seconde
 * mémorisait « hidden », et en se fermant rendait donc « hidden » — le
 * corps restait bloqué alors que plus aucune surcouche n'était ouverte.
 * Un compteur unique règle le problème : seul le dernier verrou rendu
 * restaure l'état d'origine.
 *
 * La gouttière de la barre de défilement (8 px, cf. la règle
 * `::-webkit-scrollbar` de globals.css) est compensée en `padding-right`.
 * Sans elle, l'ouverture de la moindre modale décalait toute la page de
 * 8 px vers la droite, puis la refermait en sens inverse.
 */
let verrous = 0;
let overflowInitial = "";
let paddingInitial = "";

export function verrouillerDefilement(): () => void {
  if (typeof document === "undefined") return () => undefined;

  if (verrous === 0) {
    overflowInitial = document.body.style.overflow;
    paddingInitial = document.body.style.paddingRight;
    const gouttiere = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gouttiere > 0) document.body.style.paddingRight = `${gouttiere}px`;
  }
  verrous += 1;

  // Un même verrou ne peut être rendu qu'une fois : sans ce garde-fou, un
  // double appel (React 18 monte puis démonte les effets en mode strict)
  // décrémenterait deux fois et libérerait le verrou d'une autre surcouche.
  let rendu = false;
  return () => {
    if (rendu) return;
    rendu = true;
    verrous = Math.max(0, verrous - 1);
    if (verrous === 0) {
      document.body.style.overflow = overflowInitial;
      document.body.style.paddingRight = paddingInitial;
    }
  };
}

/** Verrouille le défilement tant que `actif` est vrai. */
export function useScrollLock(actif = true) {
  useEffect(() => {
    if (!actif) return;
    return verrouillerDefilement();
  }, [actif]);
}
