/**
 * Métadonnées d'en-tête partagées entre une section réelle et son
 * squelette. Les deux doivent afficher exactement le même en-tête (titre,
 * sous-titre, lien « Voir tout ») : c'est ce qui garantit qu'une section
 * qui se remplit ne décale pas le reste de la page.
 */

/** `top_tracks` n'y figure pas : il est rendu à part, en classement numéroté dans la colonne latérale. */
export const SECTION_SEE_ALL: Record<string, string> = {
  new_releases: "/titres",
  playlists: "/bibliotheque",
  albums: "/classements",
  recommendations: "/titres",
};

export const SECTION_SUBTITLE: Record<string, string> = {
  recently_played: "Reprenez là où vous vous êtes arrêté",
  new_releases: "Les derniers titres ajoutés",
  recommendations: "Sélectionnés d'après vos écoutes",
  genres: "Choisissez une ambiance",
  playlists: "Les playlists les plus écoutées",
  albums: "À découvrir en ce moment",
};

/** Sections rendues dans la colonne latérale plutôt que dans le flux principal. */
export const SIDEBAR_SECTION_KEYS = ["top_tracks", "events", "radio", "trending_artists", "activity"];
