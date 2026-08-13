import { BadgeCheck, Award, Star } from "lucide-react";

const iconByCategory = {
  member: Star,
  artist: BadgeCheck,
  achievement: Award,
};

export function BadgeChip({
  label,
  category,
}: {
  label: string;
  category: "member" | "artist" | "achievement";
}) {
  const Icon = iconByCategory[category];
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-ink-muted">
      <Icon size={12} className={category === "artist" ? "text-verified" : "text-accent"} />
      {label}
    </span>
  );
}
