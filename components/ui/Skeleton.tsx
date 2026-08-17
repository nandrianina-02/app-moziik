/**
 * Bloc de base d'un skeleton loader : fond bg-surface + reflet qui glisse
 * (voir .animate-shimmer dans globals.css). prefers-reduced-motion est
 * déjà neutralisé globalement (animation-duration: 0.01ms), donc ce
 * composant reste accessible sans condition supplémentaire ici.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-shimmer rounded-lg bg-surface ${className}`} />;
}

/** Ligne de type SongRow/QueuePanel : couverture + titre + sous-titre. */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-2 py-2.5">
      <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  );
}

/** Plusieurs SkeletonRow d'affilée, pour une liste dont on ignore encore le contenu. */
export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-1" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

/** Carte carrée type SongCard/AlbumGrid/PlaylistGrid. */
export function SkeletonCard() {
  return (
    <div>
      <Skeleton className="aspect-square w-full rounded-xl2" />
      <Skeleton className="mt-2 h-3.5 w-4/5" />
      <Skeleton className="mt-1.5 h-3 w-1/2" />
    </div>
  );
}

/** Grille de cartes — nombre de cellules ajustable. */
export function SkeletonCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** Formulaire en cours de chargement : titre, champs étiquetés, bouton d'envoi. */
export function SkeletonForm({ fields = 5 }: { fields?: number }) {
  return (
    <div aria-busy="true" className="mx-auto w-full max-w-2xl space-y-5 px-6 py-8 md:px-10 md:py-10">
      <Skeleton className="h-7 w-1/3 min-w-[160px]" />
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      ))}
      <Skeleton className="h-11 w-40 rounded-xl" />
    </div>
  );
}

/** Avatar rond type FeaturedArtists/commentaire, avec 2 lignes de texte à côté. */
export function SkeletonAvatarLine() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-3 w-1/5" />
      </div>
    </div>
  );
}

/** Ligne de tableau générique — nombre de colonnes ajustable. */
export function SkeletonTableRow({ columns = 4 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-3.5 w-full max-w-[140px]" />
        </td>
      ))}
    </tr>
  );
}

/** Bloc commentaire : avatar + 2-3 lignes de texte. */
export function SkeletonComment() {
  return (
    <div className="flex items-start gap-3 py-3">
      <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}
