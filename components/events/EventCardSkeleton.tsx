export function EventCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl2 border border-border bg-surface">
      <div className="aspect-[16/10] w-full bg-base" />
      <div className="space-y-2.5 p-4">
        <div className="h-3.5 w-3/4 rounded bg-base" />
        <div className="h-2.5 w-1/2 rounded bg-base" />
        <div className="h-2.5 w-full rounded bg-base" />
        <div className="h-2.5 w-2/3 rounded bg-base" />
      </div>
    </div>
  );
}
