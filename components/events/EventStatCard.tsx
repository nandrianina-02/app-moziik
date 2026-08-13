import type { LucideIcon } from "lucide-react";

export function EventStatCard({
  icon: Icon,
  iconClassName,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  iconClassName: string;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl2 border border-border bg-surface p-4">
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${iconClassName}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-ink-muted">{label}</p>
        <p className="text-xl font-display leading-tight">{value}</p>
        <p className="truncate text-[11px] text-ink-muted">{hint}</p>
      </div>
    </div>
  );
}
