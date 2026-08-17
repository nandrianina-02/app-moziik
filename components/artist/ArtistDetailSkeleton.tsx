import { Skeleton, SkeletonRows, SkeletonCard } from "@/components/ui/Skeleton";

/**
 * Reprend la géométrie de la page artiste : bannière, avatar en débord,
 * puis les blocs de contenu. Même intention que
 * components/album/AlbumDetailSkeleton.tsx — la page occupe sa place tout
 * de suite, et rien ne se décale quand les données arrivent.
 */
export function ArtistDetailSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto w-full max-w-[1600px] pb-16">
      <Skeleton className="h-48 w-full rounded-none sm:h-64 md:h-72" />

      <div className="px-6 md:px-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
          <Skeleton className="-mt-14 h-28 w-28 shrink-0 rounded-full sm:-mt-16 sm:h-36 sm:w-36" />
          <div className="flex-1 space-y-3 pt-2">
            <Skeleton className="h-8 w-1/2 max-w-xs" />
            <Skeleton className="h-3.5 w-2/3 max-w-sm" />
            <div className="flex gap-3 pt-1">
              <Skeleton className="h-9 w-28 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-full" />
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-8">
            <div>
              <Skeleton className="mb-4 h-5 w-40" />
              <SkeletonRows count={5} />
            </div>
            <div>
              <Skeleton className="mb-4 h-5 w-32" />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-xl2" />
            <Skeleton className="h-56 w-full rounded-xl2" />
          </div>
        </div>
      </div>
    </div>
  );
}
