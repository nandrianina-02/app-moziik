"use client";

import { useEffect, useRef } from "react";

/**
 * Ferme une surcouche (modale, panneau) sur la touche Échap.
 *
 * `onClose` passe par une ref plutôt que par les dépendances de l'effet :
 * les appelants la passent presque toujours en fonction fléchée, donc de
 * nouvelle identité à chaque rendu du parent. Or PlayerProvider publie la
 * progression de lecture environ quatre fois par seconde et fait
 * re-rendre en continu tout ce qui l'écoute. Avec `[onClose]` en
 * dépendance, l'écouteur serait détaché et rattaché en boucle — c'est
 * exactement ce mécanisme qui avait rendu le menu contextuel impossible à
 * fermer pendant la lecture (voir components/ui/ContextMenuShell.tsx).
 */
export function useEscapeClose(onClose: () => void, enabled = true) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!enabled) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
