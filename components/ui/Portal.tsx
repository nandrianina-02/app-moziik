"use client";

import { useEffect, useState } from "react";
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
 * Le rendu est différé au montage : `document` n'existe pas côté serveur.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return createPortal(children, document.body);
}
