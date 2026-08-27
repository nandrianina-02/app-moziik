// Configuration centrale du site.
// En Phase 5 (Admin), ces valeurs seront lues depuis un document
// SiteConfig en base (modifiable dans le dashboard admin) avec ces
// valeurs comme valeurs par défaut / fallback.

export type SiteConfig = {
  siteName: string;
  tagline: string;
  logoUrl: string; // hébergé sur Cloudinary, modifiable dans /admin/parametres — utilisé dans la sidebar, le header mobile et comme icône PWA
  supportEmail: string;
  currency: {
    international: "USD" | "EUR";
    mobile: "MGA"; // à étendre selon les régions supportées
  };
  // Genres proposés à la publication d'un titre — modifiable dans
  // /admin/parametres, consommé par les pages de publication/modification
  // d'un son au lieu d'une liste codée en dur (répétée avant dans 2 fichiers).
  genres: string[];
  // Mentions légales — repli affiché avant que /api/site-config ne réponde,
  // et si l'admin n'a jamais renseigné ces champs.
  legalEntityName: string;
  legalCapital: string;
  legalRcsCity: string;
  legalRcsNumber: string;
  legalAddress: string;
  legalWebsite: string;
  /**
   * Réseaux sociaux officiels, modifiables dans /admin/parametres.
   * Vide par défaut : mieux vaut n'afficher aucun réseau que renvoyer
   * vers des comptes qui n'existent pas.
   */
  socialLinks: { platform: string; url: string }[];
};

export const defaultSiteConfig: SiteConfig = {
  siteName: "Moziik",
  tagline: "Écoute, découvre, soutiens tes artistes.",
  logoUrl: "/icon-mark.png",
  supportEmail: "contact@moziik.app",
  currency: {
    international: "USD",
    mobile: "MGA",
  },
  genres: ["Afrobeat", "Salegy", "Hip-hop", "R&B", "Pop", "Zouk", "Reggae", "Autre"],
  legalEntityName: "Moziik SAS",
  legalCapital: "10 000€",
  legalRcsCity: "Antananarivo",
  legalRcsNumber: "123 456 789",
  legalAddress: "Antananarivo, Madagascar",
  legalWebsite: "www.moziik.com",
  socialLinks: [],
};
