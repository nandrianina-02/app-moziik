import { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  color = "text-accent",
  bg,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Ligne secondaire optionnelle (tendance, précision sur le chiffre...). */
  hint?: React.ReactNode;
  /** Couleur Tailwind de l'icône, ex: "text-tint-emerald". Par défaut la couleur d'accent du thème. */
  color?: string;
  /** Fond du badge d'icône, ex: "bg-tint-emerald/10". Si omis, l'icône est affichée seule comme avant. */
  bg?: string;
}) {
  return (
    <div className="rounded-xl2 border border-border bg-surface p-5">
      {bg ? (
        <span className={`mb-3 grid h-9 w-9 place-items-center rounded-full ${bg}`}>
          <Icon size={18} className={color} />
        </span>
      ) : (
        <Icon size={18} className={`${color} mb-3`} />
      )}
      <p className="text-2xl font-display">{value}</p>
      <p className="text-xs text-ink-muted mt-1">{label}</p>
      {hint && <p className="text-xs text-ink-muted mt-1.5">{hint}</p>}
    </div>
  );
}
