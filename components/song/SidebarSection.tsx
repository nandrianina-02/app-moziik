import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

export function SidebarSection({
  icon: Icon,
  title,
  viewAllHref,
  emptyLabel,
  isEmpty,
  children,
}: {
  icon: LucideIcon;
  title: string;
  viewAllHref?: string;
  emptyLabel?: string;
  isEmpty?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl2 border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Icon size={15} className="text-accent" /> {title}
        </h3>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-xs text-ink-muted hover:text-ink"
          >
            Voir tout
          </Link>
        )}
      </div>
      {isEmpty ? (
        <p className="text-xs text-ink-muted">{emptyLabel}</p>
      ) : (
        <div className="space-y-2.5">{children}</div>
      )}
    </div>
  );
}
