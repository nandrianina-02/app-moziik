"use client";

import { useLayoutEffect, useRef, useState } from "react";

export type MenuAnchor = { x: number; y: number };

const EDGE_PADDING = 8;

/**
 * Positionne un menu flottant (menu contextuel clic droit / appui long)
 * en le clampant réellement à la fenêtre visible, à partir de sa taille
 * mesurée après rendu — pas d'une hauteur/largeur supposée à l'avance.
 * Le menu est d'abord rendu invisible à la position d'ancrage pour être
 * mesuré, puis repositionné et révélé en une frame, sans flash visuel
 * ni dépassement d'écran, y compris pour des menus de tailles variées
 * (differents jeux d'actions) ou proches d'un bord/coin.
 */
export function useClampedMenuPosition(anchor: MenuAnchor) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({
    position: "fixed",
    top: anchor.y,
    left: anchor.x,
    visibility: "hidden",
  });

  useLayoutEffect(() => {
    function place() {
      const el = ref.current;
      if (!el) return;
      const { width, height } = el.getBoundingClientRect();
      const maxLeft = Math.max(EDGE_PADDING, window.innerWidth - width - EDGE_PADDING);
      const maxTop = Math.max(EDGE_PADDING, window.innerHeight - height - EDGE_PADDING);
      const left = Math.min(Math.max(anchor.x, EDGE_PADDING), maxLeft);
      const top = Math.min(Math.max(anchor.y, EDGE_PADDING), maxTop);
      setStyle({ position: "fixed", top, left, visibility: "visible" });
    }

    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor.x, anchor.y]);

  return { ref, style };
}
