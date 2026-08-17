import { Skeleton, SkeletonRows } from "@/components/ui/Skeleton";

/**
 * Reprend la géométrie exacte de la page playlist : bandeau, pochette en
 * débord, onglets, liste et colonne latérale. Une page dessinée juste
 * puis remplie donne une attente bien plus courte à l'œil qu'un écran vide
 * avec un indicateur au centre — et surtout, rien ne bouge à l'arrivée des
 * données. Voir aussi components/album/AlbumDetailSkeleton.tsx.
 */
export function PlaylistDetailSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 md:px-10 md:py-10">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div className="overflow-hidden rounded-xl2 border border-border">
            <Skeleton className="h-32 w-full rounded-none sm:h-44 md:h-56" />
            <div className="flex flex-col gap-6 px-5 pb-6 sm:px-8 md:flex-row md:items-end md:pb-8">
              <Skeleton className="-mt-16 mx-auto aspect-square w-36 shrink-0 rounded-xl2 sm:-mt-20 sm:w-44 md:mx-0 md:-mt-24 md:w-52" />
              <div className="flex-1 space-y-3">
                <Skeleton className="mx-auto h-3.5 w-24 md:mx-0" />
                <Skeleton className="mx-auto h-7 w-2/3 md:mx-0" />
                <Skeleton className="mx-auto h-3.5 w-1/3 md:mx-0" />
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>

          <div className="mt-4">
            <SkeletonRows count={8} />
          </div>
        </div>

        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-xl2" />
          <Skeleton className="h-40 w-full rounded-xl2" />
        </div>
      </div>
    </div>
  );
}
