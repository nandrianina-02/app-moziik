"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

/**
 * Rend ses enfants directement dans <body>.
 *
 * Indispensable pour les surcouches (menus contextuels, modales) : dès
 * qu'un parent porte `position: fixed` + `z-index` — c'est le cas du
 * mini-lecteur (z-30) — il crée un *stacking context*. Tous ses
 * descendants sont alors confinés à cette couche, quel que soit leur
 * propre z-index : une modale en z-50 imbriquée dans le lecteur passait
 * ainsi SOUS la navigation mobile (z-40) et le lecteur plein écran
 * (z-50). Le portail sort l'élément de ce piège.
 *
 * Le conteneur est résolu à l'initialisation de l'état, pas dans un
 * `useEffect` : côté serveur `document` n'existe pas et on ne rend rien,
 * mais côté client le contenu doit être présent DÈS le premier rendu.
 * Le différer d'une frame laissait un premier rendu à vide pendant
 * lequel les surcouches qui se mesurent elles-mêmes ne trouvaient aucun
 * élément — les menus contextuels restaient alors invisibles.
 *
 * N'utiliser que pour des éléments montés à la suite d'une interaction :
 * un contenu rendu dès l'hydratation provoquerait une différence entre
 * le rendu serveur (vide) et le rendu client.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [container] = useState<HTMLElement | null>(() =>
    typeof document === "undefined" ? null : document.body
  );

  if (!container) return null;
  return createPortal(children, container);
}
