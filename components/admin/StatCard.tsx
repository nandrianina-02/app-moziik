import { LucideIcon } from "lucide-react";

/**
 * Un chiffre clé : libellé, valeur, précision. L'icône reste discrète, dans
 * la couleur du texte secondaire : des pastilles de couleurs différentes
 * d'une carte à l'autre faisaient tableau de bord générique, et le seul
 * accent du site doit rester réservé à ce qui demande une action.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Ligne secondaire optionnelle (tendance, précision sur le chiffre...). */
  hint?: React.ReactNode;
  /** Sans effet : conservé pour les écrans qui le passent encore. */
  color?: string;
  /** Sans effet : conservé pour les écrans qui le passent encore. */
  bg?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-5 py-4 animate-fade-in-up">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink-muted">{label}</p>
        <Icon size={15} className="shrink-0 text-ink-muted" aria-hidden />
      </div>
      <p className="mt-2 text-2xl font-display tabular-nums leading-none">
        {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
      </p>
      {hint && <p className="mt-2 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
