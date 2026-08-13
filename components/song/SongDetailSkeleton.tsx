export function SongDetailSkeleton() {
  return (
    <div className="animate-pulse px-4 py-6 sm:px-6 md:px-10 md:py-10">
      <div className="rounded-xl2 border border-border bg-surface p-5 sm:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end">
          <div className="mx-auto aspect-square w-48 rounded-xl2 bg-base sm:w-56 md:mx-0" />
          <div className="flex-1 space-y-3">
            <div className="mx-auto h-4 w-20 rounded-full bg-base md:mx-0" />
            <div className="mx-auto h-7 w-2/3 rounded bg-base md:mx-0" />
            <div className="mx-auto h-4 w-1/3 rounded bg-base md:mx-0" />
          </div>
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="h-64 rounded-xl2 bg-surface" />
        <div className="space-y-4">
          <div className="h-40 rounded-xl2 bg-surface" />
          <div className="h-40 rounded-xl2 bg-surface" />
        </div>
      </div>
    </div>
  );
}
