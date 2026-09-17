"use client";

import { useEffect, useState } from "react";

/**
 * Le clavier virtuel occupe-t-il le bas de l'écran ?
 *
 * LE PROBLÈME
 *
 * Le mini-lecteur et la navigation basse sont en `position: fixed`. Dans
 * la coquille Android, la vue web est redimensionnée à l'ouverture du
 * clavier : le bas de la fenêtre remonte, et les deux barres viennent se
 * poser **au-dessus du clavier**, en plein milieu de l'écran. Pendant une
 * recherche, elles recouvrent les suggestions qu'on est en train de lire.
 *
 * POURQUOI LE FOCUS ET NON LA HAUTEUR DE LA FENÊTRE
 *
 * On pourrait guetter `visualViewport`. Mais les deux comportements
 * possibles du navigateur se mesurent différemment — selon que c'est la
 * fenêtre de mise en page qui rétrécit ou seulement la fenêtre visible,
 * le signal n'est pas au même endroit — et il faut alors mémoriser une
 * hauteur « pleine » de référence, qu'une rotation d'écran périme.
 *
 * Le champ qui a le focus, lui, dit la même chose dans tous les cas : sur
 * un appareil tactile, un champ de saisie actif signifie un clavier
 * ouvert. Le pire qui puisse arriver si l'on se trompe est que le
 * mini-lecteur reste caché une seconde de trop.
 *
 * Restreint aux pointeurs grossiers : sur un poste avec souris, il n'y a
 * pas de clavier à l'écran, et cacher le lecteur dès qu'on clique dans un
 * champ serait absurde.
 */

/** Types d'`<input>` qui n'ouvrent aucun clavier. */
const SANS_CLAVIER = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

function ouvreUnClavier(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return !SANS_CLAVIER.has(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}

export function useClavierVisible(): boolean {
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia?.("(pointer: coarse)").matches) return;

    let differe: ReturnType<typeof setTimeout> | null = null;

    // `focusout` précède l'arrivée du focus suivant : lu tout de suite,
    // `activeElement` vaut `body` et l'on verrait les barres réapparaître
    // une image sur deux en passant d'un champ à l'autre.
    const relire = () => {
      if (differe) clearTimeout(differe);
      differe = setTimeout(() => setOuvert(ouvreUnClavier(document.activeElement)), 0);
    };

    relire();
    document.addEventListener("focusin", relire);
    document.addEventListener("focusout", relire);
    return () => {
      if (differe) clearTimeout(differe);
      document.removeEventListener("focusin", relire);
      document.removeEventListener("focusout", relire);
    };
  }, []);

  return ouvert;
}
