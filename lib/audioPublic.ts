/**
 * Ce qu'une réponse de l'API montre d'un titre.
 *
 * L'adresse audio stockée en base (`audioUrl` : fichier Cloudinary ou
 * identifiant Karaks Storage) et ses versions encodées ne sortent jamais :
 * une URL Cloudinary brute s'écoute sans passer par /api/stream, donc sans
 * quota ni plafond de qualité, et en qualité maximale. Le site comme l'app
 * ne lisent que /api/stream/<id> ; `audioUrl` y est ramené, ce qui garde
 * son rôle de marqueur « titre jouable » côté client.
 *
 * Les champs de gestion interne (ISRC, qui a publié ou validé) partent avec.
 */

const CHAMPS_INTERNES = ["audioVariantes", "isrc", "publishedBy", "approvedBy"] as const;
/** Une réponse est un arbre de quelques niveaux ; au-delà, on ne descend plus. */
const PROFONDEUR_MAX = 12;

export function adresseEcoutePublique(id: string): string {
  return `/api/stream/${id}`;
}

/**
 * Parcourt une réponse déjà passée par JSON (identifiants en chaînes) et en
 * retire l'audio brut.
 * Tout objet qui porte `audioUrl` est un titre, et son `_id` celui du
 * titre : c'est vrai de toutes les réponses du site, documents complets,
 * projections d'agrégation (classements) et titres peuplés.
 */
export function masquerAudio<T>(valeur: T, profondeur = 0): T {
  if (profondeur > PROFONDEUR_MAX || valeur === null || typeof valeur !== "object") return valeur;
  if (Array.isArray(valeur)) return valeur.map((v) => masquerAudio(v, profondeur + 1)) as T;

  const objet = valeur as Record<string, unknown>;
  const sortie: Record<string, unknown> = {};
  for (const [cle, v] of Object.entries(objet)) {
    if ((CHAMPS_INTERNES as readonly string[]).includes(cle)) continue;
    sortie[cle] = masquerAudio(v, profondeur + 1);
  }
  if ("audioUrl" in objet) {
    const id = typeof objet._id === "string" ? objet._id : typeof objet.id === "string" ? objet.id : null;
    // Sans identifiant, pas d'adresse d'écoute possible : le titre n'est pas jouable d'ici.
    if (id && objet.audioUrl) sortie.audioUrl = adresseEcoutePublique(id);
    else delete sortie.audioUrl;
  }
  return sortie as T;
}
