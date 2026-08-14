"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useClampedMenuPosition, type MenuAnchor } from "@/components/ui/useClampedMenuPosition";
import { Portal } from "@/components/ui/Portal";

/**
 * Coquille commune à tous les menus contextuels (musique, évènement,
 * album, playlist, artiste...) : positionnement clampé à l'écran
 * (voir useClampedMenuPosition), fermeture au clic ou clic droit en
 * dehors, et fermeture à l'échap. Chaque menu spécifique ne fournit
 * que ses propres <MenuItem />.
 */
export function ContextMenuShell({
  anchor,
  onClose,
  width = 224,
  children,
}: {
  anchor: MenuAnchor;
  onClose: () => void;
  width?: number;
  children: ReactNode;
}) {
  // `setRef` déclenche la mesure dès l'attachement du noeud ; `ref` sert
  // au test de clic extérieur ci-dessous.
  const { ref, setRef, style } = useClampedMenuPosition(anchor);

  // Instant d'ouverture, figé au montage.
  //
  // Il DOIT vivre dans une ref, pas dans l'effet : celui-ci dépend de
  // `onClose`, que chaque appelant passe en fonction fléchée — donc de
  // nouvelle identité à chaque rendu du parent. Or PlayerProvider publie
  // la progression de lecture ~4 fois par seconde, ce qui fait re-rendre
  // tous les composants qui l'écoutent (lignes de titre, cartes,
  // mini-lecteur). Placé dans l'effet, le délai ci-dessous se réarmait
  // à chaque re-rendu et n'expirait jamais : le menu devenait
  // impossible à fermer d'un clic extérieur pendant la lecture.
  const openedAtRef = useRef(Date.now());

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      // Neutralise les évènements souris de compatibilité émis juste
      // après un `touchend` (la première protection est le
      // preventDefault de useLongPress, que tous les navigateurs
      // mobiles n'honorent pas) : ils refermaient le menu à l'instant
      // même où l'appui long venait de l'ouvrir. Personne ne referme un
      // menu volontairement en moins de 300 ms.
      if (Date.now() - openedAtRef.current < 300) return;
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("contextmenu", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("contextmenu", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  return (
    // Portail obligatoire : un menu ouvert depuis le mini-lecteur (parent
    // fixed + z-30) serait sinon confiné à cette couche et passerait sous
    // la navigation mobile. Voir components/ui/Portal.tsx.
    <Portal>
      <div
        ref={setRef}
        style={{ ...style, width }}
        className="z-[60] rounded-xl2 border border-border bg-surface py-1.5 shadow-2xl"
      >
        {children}
      </div>
    </Portal>
  );
}

export function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors hover:bg-base disabled:opacity-60 disabled:hover:bg-transparent ${
        danger ? "text-accent" : ""
      }`}
    >
      <Icon size={15} className={danger ? "text-accent" : "text-ink-muted"} />
      {label}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="my-1.5 h-px bg-border" />;
}
