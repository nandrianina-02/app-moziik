/**
 * Grille responsive pour les cartes de liste admin (musiques, albums,
 * évènements, playlists...). Une seule colonne sur mobile, davantage sur
 * grand écran — au lieu d'un empilement vertical qui gâche l'espace
 * desktop quel que soit la largeur de la fenêtre.
 *
 * cols=2 : réservé aux cartes avec beaucoup de boutons d'action (jusqu'à
 * 4 : approuver/rejeter/modifier/supprimer) qui ont besoin de plus de
 * largeur par carte. cols=3 (défaut) : cartes avec 1-2 actions.
 */
export function AdminItemGrid({ cols = 3, children }: { cols?: 2 | 3; children: React.ReactNode }) {
  const colsClass = cols === 2 ? "lg:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3";
  return <div className={`grid grid-cols-1 ${colsClass} gap-3`}>{children}</div>;
}
