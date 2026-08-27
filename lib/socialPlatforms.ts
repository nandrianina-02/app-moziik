/**
 * Réseaux sociaux proposés à l'administration.
 *
 * La liste est fermée volontairement : chaque entrée porte une couleur de
 * marque et une icône, et un réseau inconnu n'aurait ni l'une ni l'autre.
 * Ajouter un réseau, c'est ajouter une ligne ici — le formulaire
 * d'administration, la page de contact et le pied de page s'y adaptent
 * seuls.
 *
 * `exemple` sert de valeur d'aide dans le champ de saisie : il montre la
 * forme d'URL attendue sans rien imposer, l'administration restant libre
 * de coller l'adresse exacte de sa page.
 */
export type IdentifiantReseau =
  | "facebook"
  | "instagram"
  | "youtube"
  | "tiktok"
  | "x"
  | "linkedin"
  | "whatsapp"
  | "telegram";

export type DefinitionReseau = {
  id: IdentifiantReseau;
  label: string;
  /** Aplat de marque, identique en thème clair et sombre (exception logotype WCAG). */
  couleur: string;
  exemple: string;
};

export const RESEAUX: DefinitionReseau[] = [
  { id: "facebook", label: "Facebook", couleur: "#1877F2", exemple: "https://facebook.com/moziik" },
  { id: "instagram", label: "Instagram", couleur: "#D62976", exemple: "https://instagram.com/moziik" },
  { id: "youtube", label: "YouTube", couleur: "#FF0000", exemple: "https://youtube.com/@moziik" },
  { id: "tiktok", label: "TikTok", couleur: "#010101", exemple: "https://tiktok.com/@moziik" },
  { id: "x", label: "X (Twitter)", couleur: "#000000", exemple: "https://x.com/moziik" },
  { id: "linkedin", label: "LinkedIn", couleur: "#0A66C2", exemple: "https://linkedin.com/company/moziik" },
  { id: "whatsapp", label: "WhatsApp", couleur: "#25D366", exemple: "https://wa.me/261340000000" },
  { id: "telegram", label: "Telegram", couleur: "#26A5E4", exemple: "https://t.me/moziik" },
];

export const IDS_RESEAUX = RESEAUX.map((r) => r.id) as [IdentifiantReseau, ...IdentifiantReseau[]];

export function definitionReseau(id: string): DefinitionReseau | undefined {
  return RESEAUX.find((r) => r.id === id);
}

/** Lien social tel qu'il est stocké et affiché. */
export type LienSocial = { platform: IdentifiantReseau; url: string };

/**
 * N'accepte que http(s), et rejette tout le reste.
 *
 * Une URL de réseau social finit dans un `href` : sans ce filtre, une
 * valeur `javascript:` saisie en administration deviendrait un lien
 * exécutable pour tous les visiteurs.
 */
export function urlSocialeValide(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Liens exploitables : réseau connu, URL http(s), un seul lien par réseau. */
export function liensSociauxUtilisables(liens: unknown): LienSocial[] {
  if (!Array.isArray(liens)) return [];
  const vus = new Set<string>();
  const sortie: LienSocial[] = [];
  for (const lien of liens) {
    const l = lien as Partial<LienSocial> | null;
    if (!l?.platform || typeof l.url !== "string") continue;
    if (!definitionReseau(l.platform) || vus.has(l.platform)) continue;
    if (!urlSocialeValide(l.url)) continue;
    vus.add(l.platform);
    sortie.push({ platform: l.platform, url: l.url.trim() });
  }
  return sortie;
}
