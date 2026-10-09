/**
 * Adresses des fichiers rangés sur Karaks Storage.
 *
 * Karaks Storage ne donne jamais d'adresse publique : un fichier se lit par
 * un lien signé, qui expire. Ce qu'on enregistre en base ne peut donc pas
 * être une URL de fichier. Deux formes, selon l'usage :
 *
 * - `/media/<file_…>` pour ce qui s'affiche tel quel (pochettes, avatars,
 *   bannières, clips, pièces jointes). C'est une adresse de Moziik, stable,
 *   qui fabrique le lien signé à la demande (voir `app/media/[id]`) : elle
 *   marche partout où une URL marchait, `<img>` et `next/image` compris ;
 * - `ks:<file_…>` pour la source d'un titre. Elle ne s'ouvre nulle part
 *   directement : l'écoute passe par `/api/stream/<id>`, qui choisit la
 *   qualité et applique le quota. Une adresse lisible ici contournerait les
 *   deux.
 *
 * Les adresses Cloudinary déjà en base restent valides et lisibles.
 *
 * Module sans dépendance serveur : il sert au navigateur comme aux routes.
 */
export const PREFIXE_SOURCE = "ks:";
const IDENTIFIANT = /^file_[0-9A-Za-z]{6,32}$/;

export function estIdentifiantFichier(valeur: string): boolean {
  return IDENTIFIANT.test(valeur);
}

export function adresseMedia(fichierId: string): string {
  return `/media/${fichierId}`;
}

export function cleSource(fichierId: string): string {
  return `${PREFIXE_SOURCE}${fichierId}`;
}

/** Identifiant Karaks Storage d'une adresse enregistrée, ou `null` pour une adresse externe. */
export function identifiantFichier(adresse: string | null | undefined): string | null {
  if (!adresse) return null;
  const id = adresse.startsWith(PREFIXE_SOURCE)
    ? adresse.slice(PREFIXE_SOURCE.length)
    : adresse.startsWith("/media/")
      ? adresse.slice("/media/".length)
      : null;
  return id && estIdentifiantFichier(id) ? id : null;
}

/**
 * Valeur acceptable pour un champ de fichier : une URL http(s) (Cloudinary,
 * Google), une adresse `/media/…` ou une clé `ks:…`.
 */
export function estAdresseFichier(valeur: string): boolean {
  if (identifiantFichier(valeur)) return true;
  try {
    const url = new URL(valeur);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
