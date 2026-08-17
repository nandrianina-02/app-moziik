"use client";

import { useRef, useState, type ReactNode } from "react";
import { Portal } from "@/components/ui/Portal";

/**
 * Infobulle du menu latéral replié — c'est le seul moyen d'y identifier
 * une icône, elle ne doit donc jamais être rognée.
 *
 * Elle était positionnée en `absolute left-full`, c'est-à-dire *hors* de
 * la sidebar. Or celle-ci défile verticalement, et une valeur d'overflow
 * non-`visible` sur un axe force l'autre à `auto` : le libellé sortait donc
 * du cadre de défilement et se retrouvait coupé. Le rendre en portail, en
 * position fixe calculée à partir du déclencheur, l'affranchit de tout
 * ancêtre qui rogne.
 */
export function Tooltip({ label, show, children }: { label: string; show: boolean; children: ReactNode }) {
  const ancreRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  function placer() {
    const rect = ancreRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.top + rect.height / 2, left: rect.right + 12 });
  }

  function masquer() {
    setPosition(null);
  }

  if (!show) return <>{children}</>;

  return (
    <span
      ref={ancreRef}
      className="flex"
      onPointerEnter={placer}
      onPointerLeave={masquer}
      onFocusCapture={placer}
      onBlurCapture={masquer}
    >
      {children}
      {position && (
        <Portal>
          <span
            role="tooltip"
            style={{ top: position.top, left: position.left }}
            className="animate-fade-in pointer-events-none fixed z-[60] -translate-y-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-base shadow-lg"
          >
            {label}
          </span>
        </Portal>
      )}
    </span>
  );
}
