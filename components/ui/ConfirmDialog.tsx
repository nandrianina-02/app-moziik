"use client";

import { AlertTriangle } from "lucide-react";
import { Portal } from "@/components/ui/Portal";

/**
 * Petite modale de confirmation générique, utilisée avant toute action
 * destructive (suppression...). Ne modifie aucune logique métier —
 * c'est uniquement une étape de confirmation côté UI.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirmer",
  danger = true,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    // Portail : cette confirmation peut être ouverte depuis un menu
    // contextuel ou le mini-lecteur, dont le parent `fixed` piégerait la
    // surcouche dans sa propre couche. Voir components/ui/Portal.tsx.
    <Portal>
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl2 border border-border bg-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`grid h-11 w-11 place-items-center rounded-full ${
            danger ? "bg-accent/10 text-accent" : "bg-verified/10 text-verified"
          }`}
        >
          <AlertTriangle size={20} />
        </div>
        <h2 className="mt-4 text-base font-display">{title}</h2>
        {description && <p className="mt-1.5 text-sm text-ink-muted">{description}</p>}

        <div className="mt-6 flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors disabled:opacity-60 ${
              danger ? "bg-accent text-base hover:bg-accent-hover" : "bg-verified text-base hover:opacity-90"
            }`}
          >
            {busy ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
