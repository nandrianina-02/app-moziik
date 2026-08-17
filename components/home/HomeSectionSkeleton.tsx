import { Skeleton, SkeletonCard, SkeletonAvatarLine } from "@/components/ui/Skeleton";
import { SectionHeader } from "@/components/home/SectionHeader";
import { SECTION_SEE_ALL, SECTION_SUBTITLE } from "@/components/home/sectionMeta";

/** Grille de cartes carrées, aux mêmes points de rupture que les sections réelles. */
function CardGrid({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/**
 * Squelette d'une section de l'accueil encore en cours de calcul.
 *
 * L'en-tête est le vrai : titre, sous-titre et lien « Voir tout » sont
 * connus dès la première ligne du flux (voir useHomepageStream). Seul le
 * corps est grisé, et il reprend la géométrie exacte du contenu attendu —
 * une section qui se remplit ne pousse donc pas celles d'en dessous.
 */
export function HomeSectionSkeleton({ sectionKey, title }: { sectionKey: string; title: string }) {
  function body() {
    switch (sectionKey) {
      case "for_you":
        return (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/3] w-full rounded-xl2" />
            ))}
          </div>
        );
      case "recently_played":
        return (
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="w-32 shrink-0 sm:w-40">
                <SkeletonCard />
              </div>
            ))}
          </div>
        );
      case "genres":
        return (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[16/9] w-full rounded-xl2" />
            ))}
          </div>
        );
      default:
        return <CardGrid count={6} />;
    }
  }

  return (
    <section aria-busy="true">
      <SectionHeader title={title} subtitle={SECTION_SUBTITLE[sectionKey]} seeAllHref={SECTION_SEE_ALL[sectionKey]} />
      {body()}
    </section>
  );
}

/** Squelette d'une carte de la colonne latérale (top des titres, évènements, artistes, activité...). */
export function HomeSidebarSkeleton({ sectionKey }: { sectionKey: string }) {
  const rows = sectionKey === "top_tracks" ? 5 : sectionKey === "trending_artists" ? 4 : 3;

  return (
    <div aria-busy="true" className="rounded-xl2 border border-border bg-surface p-4">
      <Skeleton className="mb-4 h-4 w-2/5" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonAvatarLine key={i} />
        ))}
      </div>
    </div>
  );
}
