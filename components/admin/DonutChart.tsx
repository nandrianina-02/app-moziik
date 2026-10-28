/**
 * Une répartition (statuts, types de comptes…), en barres horizontales
 * d'un seul accent. Elle remplaçait un anneau à six couleurs : des parts
 * d'anneau se comparent mal à l'œil, et la légende colorée obligeait à
 * faire l'aller-retour. Le nom reste celui d'origine pour ne pas toucher
 * aux écrans qui l'emploient.
 */
export function DonutChart({ segments }: { segments: { label: string; count: number }[] }) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  const max = Math.max(1, ...segments.map((s) => s.count));

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {segments.map((s) => (
          <li key={s.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-ink">{s.label}</span>
              <span className="tabular-nums text-ink-muted">
                {s.count.toLocaleString("fr-FR")}
                {total > 0 && <span className="ml-1.5 text-xs">{Math.round((s.count / total) * 100)} %</span>}
              </span>
            </div>
            <div className="h-1 bg-border">
              <div className="h-1 bg-accent transition-[width] duration-300" style={{ width: `${(s.count / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-medium">
        <span>Total</span>
        <span className="tabular-nums">{total.toLocaleString("fr-FR")}</span>
      </div>
    </div>
  );
}
