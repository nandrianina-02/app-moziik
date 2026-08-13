import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type Tone = "default" | "success" | "danger";

const toneClasses: Record<Tone, string> = {
  default: "border-border text-ink-muted hover:border-accent hover:text-accent",
  success: "border-verified text-verified hover:bg-verified/10",
  danger: "border-accent text-accent hover:bg-accent/10",
};

type CommonProps = {
  icon: LucideIcon;
  label: string;
  tone?: Tone;
  size?: number;
};

/** Bouton d'action circulaire (approuver, modifier, supprimer...) utilisé dans toutes les listes admin. */
export function IconActionButton({
  icon: Icon,
  label,
  tone = "default",
  size = 15,
  onClick,
}: CommonProps & { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors ${toneClasses[tone]}`}
    >
      <Icon size={size} />
    </button>
  );
}

/** Variante lien, pour naviguer vers une page d'édition par exemple. */
export function IconActionLink({ icon: Icon, label, tone = "default", size = 15, href }: CommonProps & { href: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors ${toneClasses[tone]}`}
    >
      <Icon size={size} />
    </Link>
  );
}
