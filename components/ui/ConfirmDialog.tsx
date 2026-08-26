"use client";

import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { Portal } from "@/components/ui/Portal";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { useScrollLock } from "@/lib/scrollLock";

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
  useEscapeClose(onCancel);
  // Sans verrou, la page continuait de défiler derrière la confirmation.
  useScrollLock();
  return (
    // Portail : cette confirmation peut être ouverte depuis un menu
    // contextuel ou le mini-lecteur, dont le parent `fixed` piégerait la
    // surcouche dans sa propre couche. Voir components/ui/Portal.tsx.
    <Portal>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[80] grid place-items-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      {/* Une confirmation reste une boîte centrée : la transformer en
          feuille venue du bas éloignerait les deux boutons du pouce sans
          rien gagner. Elle monte simplement de quelques pixels. */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
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
        <h2 className="mt-4 text-base text-ink font-display">{title}</h2>
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
      </motion.div>
    </motion.div>
    </Portal>
  );
}
