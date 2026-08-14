import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * En-tête de section unifié de l'accueil : même typographie, même
 * espacement et même lien "Voir tout" partout, au lieu d'un rendu
 * légèrement différent selon les blocs.
 */
export function SectionHeader({
  title,
  subtitle,
  badge,
  seeAllHref,
  icon,
}: {
  title: string;
  subtitle?: string;
  /** Pastille courte à côté du titre, ex. "NOUVEAU". */
  badge?: string;
  seeAllHref?: string;
  /** Emoji ou petit visuel affiché avant le titre. */
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-display text-lg leading-tight tracking-tight text-ink">
          {icon}
          <span className="truncate">{title}</span>
          {badge && (
            <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
              {badge}
            </span>
          )}
        </h2>
        {subtitle && <p className="mt-0.5 truncate text-xs text-ink-muted">{subtitle}</p>}
      </div>

      {seeAllHref && (
        <Link
          href={seeAllHref}
          className="group flex shrink-0 items-center gap-0.5 text-xs font-medium text-ink-muted transition-colors hover:text-accent"
        >
          Voir tout
          <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
