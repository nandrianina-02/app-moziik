"use client";

import { useEffect, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useClampedMenuPosition, type MenuAnchor } from "@/components/ui/useClampedMenuPosition";

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
  const { ref, style } = useClampedMenuPosition(anchor);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
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
    <div
      ref={ref}
      style={{ ...style, width }}
      className="z-50 rounded-xl2 border border-border bg-surface py-1.5 shadow-2xl"
    >
      {children}
    </div>
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
