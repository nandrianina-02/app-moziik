"use client";

export function LibrarySectionHeader({
  title,
  onSeeAll,
}: {
  title: string;
  onSeeAll?: () => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-base font-display">{title}</h2>
      {onSeeAll && (
        <button onClick={onSeeAll} className="text-xs font-medium text-accent hover:underline">
          Tout voir
        </button>
      )}
    </div>
  );
}
