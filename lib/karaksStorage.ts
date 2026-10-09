import { ApiError } from "@/lib/apiError";

/**
 * Client serveur de Karaks Storage, le service de stockage et de diffusion
 * partagé avec Karaks.
 *
 * La clé API ne quitte jamais le serveur : le navigateur reçoit seulement,
 * pour un envoi, une adresse à jeton valable pour ce seul fichier, et pour
 * une lecture, un lien signé qui expire.
 *
 * Sans `KARAKS_STORAGE_URL` et `KARAKS_STORAGE_API_KEY`, Moziik continue
 * d'envoyer sur Cloudinary : la bascule se fait en renseignant les deux
 * variables, sans autre déploiement de code.
 */

export function stockageActif(): boolean {
  return Boolean(process.env.KARAKS_STORAGE_URL && process.env.KARAKS_STORAGE_API_KEY);
}

function configuration() {
  const base = process.env.KARAKS_STORAGE_URL?.replace(/\/+$/, "");
  const cle = process.env.KARAKS_STORAGE_API_KEY;
  if (!base || !cle) throw new ApiError("Le stockage des fichiers n'est pas configuré.", 503);
  return { base, cle };
}

/** Erreur du service, avec son statut : 4xx est un refus lisible, 5xx une panne. */
export class ErreurStockage extends ApiError {
  constructor(message: string, status: number) {
    super(message, status);
  }
}

async function appel<T>(chemin: string, init: { method?: string; corps?: unknown } = {}): Promise<T> {
  const { base, cle } = configuration();
  const requete = () =>
    fetch(`${base}${chemin}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${cle}`,
        ...(init.corps === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: init.corps === undefined ? undefined : JSON.stringify(init.corps),
      cache: "no-store",
    });
  let reponse: Response;
  try {
    reponse = await requete();
  } catch {
    // Une connexion gardée ouverte a pu être fermée entre deux appels : un
    // seul nouvel essai, sans effet de bord (au pire un lien de plus).
    try {
      reponse = await requete();
    } catch {
      throw new ErreurStockage("Le service de stockage est injoignable. Réessaie dans un instant.", 503);
    }
  }
  const donnees = (await reponse.json().catch(() => null)) as ({ error?: { message?: string } } & T) | null;
  if (!reponse.ok || !donnees) {
    const message = donnees?.error?.message;
    // Un refus (format, quota, taille) se transmet tel quel, il est rédigé
    // pour être lu. Une panne reste générique.
    if (reponse.status < 500 && message) throw new ErreurStockage(message, reponse.status === 507 ? 507 : reponse.status);
    throw new ErreurStockage("Le service de stockage est indisponible. Réessaie dans un instant.", 503);
  }
  return donnees;
}

// --- Dossiers -----------------------------------------------------------------

const dossiers = new Map<string, string>();

/** Dossier du projet, créé au premier besoin et retenu ensuite. */
export async function dossierStockage(nom: string): Promise<string | null> {
  const connu = dossiers.get(nom);
  if (connu) return connu;
  const lister = () => appel<{ folders: { id: string; name: string }[] }>("/api/v1/folders");
  try {
    const existant = (await lister()).folders.find((dossier) => dossier.name === nom);
    if (existant) {
      dossiers.set(nom, existant.id);
      return existant.id;
    }
    const cree = await appel<{ folder: { id: string } }>("/api/v1/folders", { method: "POST", corps: { name: nom } });
    dossiers.set(nom, cree.folder.id);
    return cree.folder.id;
  } catch (erreur) {
    // Deux envois simultanés peuvent créer le dossier en même temps.
    if (erreur instanceof ErreurStockage && erreur.status === 409) {
      const trouve = (await lister()).folders.find((dossier) => dossier.name === nom);
      if (trouve) {
        dossiers.set(nom, trouve.id);
        return trouve.id;
      }
    }
    // Une clé sans droit sur les dossiers range à la racine plutôt que
    // de faire échouer l'envoi.
    if (erreur instanceof ErreurStockage && erreur.status === 403) return null;
    throw erreur;
  }
}

// --- Envoi --------------------------------------------------------------------

export interface EnvoiOuvert {
  fichierId: string;
  /** Adresse à jeton : le navigateur y envoie les morceaux, sans la clé. */
  adresseEnvoi: string;
  tailleMorceau: number;
}

export async function ouvrirEnvoi(fichier: {
  nom: string;
  type: string;
  taille: number;
  dossierId: string | null;
  duree?: number;
}): Promise<EnvoiOuvert> {
  const donnees = await appel<{ upload: { fileId: string }; uploadUrl: string; chunkSize: number }>("/api/v1/uploads", {
    method: "POST",
    corps: {
      name: fichier.nom,
      mimeType: fichier.type,
      size: fichier.taille,
      folderId: fichier.dossierId,
      ...(fichier.duree ? { durationSeconds: fichier.duree } : {}),
    },
  });
  return { fichierId: donnees.upload.fileId, adresseEnvoi: donnees.uploadUrl, tailleMorceau: donnees.chunkSize };
}

// --- Lecture ------------------------------------------------------------------

export interface InfosFichier {
  id: string;
  type: string;
  taille: number;
  dossierId: string | null;
  statut: string;
}

const infos = new Map<string, { valeur: InfosFichier; jusqua: number }>();

/** Métadonnées d'un fichier, gardées dix minutes : `/media` les relit à chaque affichage. */
export async function infosFichier(fichierId: string): Promise<InfosFichier | null> {
  const enCache = infos.get(fichierId);
  if (enCache && enCache.jusqua > Date.now()) return enCache.valeur;
  try {
    const { file } = await appel<{ file: { id: string; mimeType: string; size: number; folderId: string | null; status: string } }>(
      `/api/v1/files/${encodeURIComponent(fichierId)}`,
    );
    const valeur = { id: file.id, type: file.mimeType, taille: file.size, dossierId: file.folderId, statut: file.status };
    infos.set(fichierId, { valeur, jusqua: Date.now() + 10 * 60_000 });
    return valeur;
  } catch (erreur) {
    if (erreur instanceof ErreurStockage && erreur.status === 404) return null;
    throw erreur;
  }
}

/** Durée de vie d'un lien : assez pour écouter un titre ou un clip entier, reprises comprises. */
const DUREE_LIEN = 6 * 60 * 60;
const liens = new Map<string, { url: string; jusqua: number }>();

/**
 * Lien de lecture signé. Réutilisé tant qu'il lui reste au moins une heure :
 * chaque écoute n'a pas à coûter un appel au service, et un lecteur qui
 * reprend une lecture garde une adresse valide.
 */
export async function lienLecture(fichierId: string, type: "stream" | "download" = "stream"): Promise<string> {
  const cle = `${type}:${fichierId}`;
  const enCache = liens.get(cle);
  if (enCache && enCache.jusqua - Date.now() > 60 * 60_000) return enCache.url;
  const { url, expiresAt } = await appel<{ url: string; expiresAt: string }>(
    `/api/v1/files/${encodeURIComponent(fichierId)}/signed-url`,
    { method: "POST", corps: { type, expiresIn: DUREE_LIEN } },
  );
  liens.set(cle, { url, jusqua: new Date(expiresAt).getTime() });
  if (liens.size > 5000) {
    for (const [cleLien, lien] of liens) if (lien.jusqua < Date.now()) liens.delete(cleLien);
  }
  return url;
}

/**
 * Mise à la corbeille d'un fichier devenu inutile (variante remplacée).
 * Karaks Storage le supprime définitivement après le délai de sa corbeille :
 * une erreur se rattrape jusque-là.
 */
export async function retirerFichier(fichierId: string): Promise<void> {
  try {
    await appel(`/api/v1/files/${encodeURIComponent(fichierId)}`, { method: "DELETE" });
  } catch (erreur) {
    if (erreur instanceof ErreurStockage && erreur.status === 404) return;
    throw erreur;
  }
  infos.delete(fichierId);
}
