// Teintes du thème plutôt que des hexadécimaux : les nuances vives
// choisies pour le fond indigo passaient mal sur le fond crème.
const palette = [
  "rgb(var(--color-accent))",
  "rgb(var(--tint-violet))",
  "rgb(var(--tint-emerald))",
  "rgb(var(--tint-amber))",
  "rgb(var(--tint-sky))",
  "rgb(var(--tint-pink))",
];

export function DonutChart({ segments }: { segments: { label: string; count: number }[] }) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  const size = 160;
  const radius = 60;
  const strokeWidth = 22;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-40 w-40 shrink-0 -rotate-90">
        {total === 0 ? (
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" className="text-border" strokeWidth={strokeWidth} />
        ) : (
          segments.map((s, i) => {
            const fraction = s.count / total;
            const dash = fraction * circumference;
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={palette[i % palette.length]}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap={segments.length > 1 ? "butt" : "round"}
              />
            );
            offset += dash;
            return el;
          })
        )}
      </svg>

      <dl className="w-full space-y-2 text-sm">
        {segments.map((s, i) => (
          <div key={s.label} className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-2 text-ink-muted">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: palette[i % palette.length] }} />
              {s.label}
            </dt>
            <dd className="text-ink">
              {s.count} {total > 0 && <span className="text-ink-muted">({Math.round((s.count / total) * 100)}%)</span>}
            </dd>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-border pt-2 font-medium">
          <dt>Total</dt>
          <dd>{total}</dd>
        </div>
      </dl>
    </div>
  );
}
