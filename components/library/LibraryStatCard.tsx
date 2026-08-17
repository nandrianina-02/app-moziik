"use client";

import type { LucideIcon } from "lucide-react";

const TINTS = {
  rose: "bg-tint-rose/15 text-tint-rose",
  emerald: "bg-verified/15 text-verified",
  indigo: "bg-tint-indigo/15 text-tint-indigo",
  amber: "bg-tint-amber/15 text-tint-amber",
} as const;

export function LibraryStatCard({
  icon: Icon,
  label,
  count,
  unit,
  tint,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  unit: string;
  tint: keyof typeof TINTS;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl2 border bg-surface p-4 text-left transition-colors ${
        active ? "border-accent" : "border-border hover:border-accent/50"
      }`}
    >
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TINTS[tint]}`}>
        <Icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span className="block text-xs text-ink-muted">
          {count} {unit}
        </span>
      </span>
    </button>
  );
}
