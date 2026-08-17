import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Gabarits d'attente de l'espace d'administration.
 *
 * Les écrans d'admin affichaient tous un indicateur centré : la page
 * sautait de « vide » à « pleine », et sa hauteur changeait d'un coup. Ces
 * gabarits occupent la place du contenu attendu, si bien que rien ne se
 * décale à l'arrivée des données.
 */

/** Rangée de cartes de statistiques (tableau de bord, en-têtes de section). */
export function AdminStatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-busy="true" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl2" />
      ))}
    </div>
  );
}

/** Liste ou grille d'entités administrables (sons, albums, membres, commentaires...). */
export function AdminCardsSkeleton({ count = 6, cols = 2 }: { count?: number; cols?: 1 | 2 | 3 }) {
  const grid = cols === 1 ? "grid-cols-1" : cols === 3 ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1 lg:grid-cols-2";
  return (
    <div aria-busy="true" className={`grid gap-3 ${grid}`}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-[72px] rounded-xl2" />
      ))}
    </div>
  );
}

/** Panneau plein : formulaire de réglages, tableau de configuration. */
export function AdminPanelSkeleton({ height = "h-64" }: { height?: string }) {
  return <Skeleton aria-busy="true" className={`w-full rounded-xl2 ${height}`} />;
}
