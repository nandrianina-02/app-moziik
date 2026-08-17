/**
 * Groupes de pages sur lesquels des sections éditoriales peuvent être
 * configurées. Chaque groupe rassemble des écrans jumelles : l'admin
 * configure une fois, le réglage s'applique aux deux.
 *
 * Volontairement isolé du modèle Mongoose : ces constantes sont lues par
 * l'écran d'administration, qui tourne dans le navigateur. Les importer
 * depuis models/HomepageSection.ts y embarquerait mongoose.
 */
export const SECTION_PAGES = ["home", "discover", "radio", "library", "detail"] as const;

export type SectionPage = (typeof SECTION_PAGES)[number];

export const SECTION_PAGE_LABEL: Record<SectionPage, string> = {
  home: "Accueil",
  discover: "Recherche & Découvrir",
  radio: "Radio & Classements",
  library: "Bibliothèque & Évènements",
  detail: "Pages artiste, album et son",
};

/**
 * Page où prévisualiser le résultat. `detail` n'en a pas : elle dépend
 * d'un contenu précis, il n'existe pas d'URL fixe à ouvrir.
 */
export const SECTION_PAGE_PREVIEW: Record<SectionPage, string | null> = {
  home: "/",
  discover: "/titres",
  radio: "/radio",
  library: "/bibliotheque",
  detail: null,
};
