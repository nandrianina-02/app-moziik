import { uploadToCloudinaryClient } from "@/lib/cloudinaryClient";
import { adresseMedia, cleSource } from "@/lib/fichiers";
import type { DossierEnvoi } from "@/lib/envoiRegles";

/**
 * Envoi d'un fichier depuis le navigateur.
 *
 * Le serveur ouvre l'envoi chez Karaks Storage et renvoie une adresse à
 * jeton ; le fichier y part directement, par morceaux de quelques
 * mégaoctets. Une coupure réseau ne fait pas tout recommencer : le service
 * dit combien d'octets il a gardés, et l'envoi reprend de là.
 *
 * Même signature que l'ancien envoi Cloudinary, vers lequel on retombe tant
 * que Karaks Storage n'est pas configuré côté serveur.
 */

export interface FichierEnvoye {
  /** Adresse à enregistrer : `/media/…`, ou `ks:…` pour la source d'un titre. */
  url: string;
  /** Identifiant Karaks Storage, absent pour un envoi Cloudinary. */
  fichierId?: string;
  duration?: number;
}

interface Ouverture {
  mode: "karaks-storage" | "cloudinary";
  fichierId: string;
  adresseEnvoi: string;
  tailleMorceau: number;
}

const ESSAIS = 4;

function attendre(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Durée d'un fichier audio ou vidéo, lue dans ses métadonnées. */
export function lireDuree(fichier: Blob): Promise<number | undefined> {
  if (!fichier.type.startsWith("audio/") && !fichier.type.startsWith("video/")) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(fichier);
    const media = document.createElement(fichier.type.startsWith("video/") ? "video" : "audio");
    media.preload = "metadata";
    const fin = (valeur?: number) => {
      URL.revokeObjectURL(url);
      resolve(valeur && Number.isFinite(valeur) ? valeur : undefined);
    };
    media.onloadedmetadata = () => fin(media.duration);
    media.onerror = () => fin(undefined);
    setTimeout(() => fin(undefined), 15_000);
    media.src = url;
  });
}

/** Un morceau, avec la progression des octets en cours d'envoi. */
function envoyerMorceau(
  adresse: string,
  morceau: Blob,
  debut: number,
  total: number,
  onOctets: (octets: number) => void,
): Promise<{ statut: number; corps: { upload?: { received: number }; file?: unknown; error?: { message?: string } } | null }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", adresse);
    xhr.setRequestHeader("Content-Range", `bytes ${debut}-${debut + morceau.size - 1}/${total}`);
    xhr.upload.onprogress = (e) => onOctets(e.loaded);
    xhr.onload = () => {
      let corps = null;
      try {
        corps = JSON.parse(xhr.responseText);
      } catch {
        corps = null;
      }
      resolve({ statut: xhr.status, corps });
    };
    xhr.onerror = () => reject(new Error("Erreur réseau pendant l'envoi du fichier."));
    xhr.send(morceau);
  });
}

async function deposer(fichier: Blob, ouverture: Ouverture, onProgress?: (pourcent: number) => void) {
  let envoye = 0;
  let essais = 0;
  const signaler = (octets: number) => onProgress?.(Math.min(100, Math.round((octets / fichier.size) * 100)));

  while (envoye < fichier.size) {
    const fin = Math.min(envoye + ouverture.tailleMorceau, fichier.size);
    try {
      const { statut, corps } = await envoyerMorceau(ouverture.adresseEnvoi, fichier.slice(envoye, fin), envoye, fichier.size, (o) =>
        signaler(envoye + o),
      );
      if (statut < 200 || statut >= 300) {
        // Un refus du service (contenu qui ne correspond pas au format,
        // quota atteint) ne changera pas en réessayant.
        const message = corps?.error?.message ?? "Le fichier a été refusé par le stockage.";
        if (statut >= 400 && statut < 500 && statut !== 429) throw Object.assign(new Error(message), { definitif: true });
        throw new Error(message);
      }
      envoye = corps?.upload?.received ?? fin;
      essais = 0;
      signaler(envoye);
      if (corps?.file) return;
    } catch (erreur) {
      if ((erreur as { definitif?: boolean }).definitif || essais >= ESSAIS) throw erreur;
      essais += 1;
      await attendre(1000 * 2 ** (essais - 1));
      // Où en est le service : c'est lui qui fait foi après une coupure.
      const etat = await fetch(ouverture.adresseEnvoi)
        .then((r) => r.json())
        .catch(() => null);
      if (etat?.file) return;
      if (typeof etat?.upload?.received === "number") envoye = etat.upload.received;
    }
  }
}

async function lireErreur(reponse: Response, defaut: string) {
  const donnees = await reponse.json().catch(() => null);
  return typeof donnees?.error === "string" ? donnees.error : defaut;
}

/**
 * Envoie un fichier dans un dossier. Pour un objet `Blob` sans nom (une
 * variante encodée), `nom` le fournit.
 */
export async function envoyerFichier(
  fichier: File | Blob,
  dossier: DossierEnvoi,
  onProgress?: (pourcent: number) => void,
  options: { nom?: string; duree?: number } = {},
): Promise<FichierEnvoye> {
  const nom = options.nom ?? (fichier instanceof File ? fichier.name : "fichier");
  const duree = options.duree ?? (await lireDuree(fichier));

  const reponse = await fetch("/api/fichiers/envoi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nom, type: fichier.type || "application/octet-stream", taille: fichier.size, dossier, duree }),
  });
  if (!reponse.ok) throw new Error(await lireErreur(reponse, "Impossible de préparer l'envoi du fichier."));
  const ouverture = (await reponse.json()) as Ouverture;

  if (ouverture.mode === "cloudinary") {
    const envoi = await uploadToCloudinaryClient(
      fichier instanceof File ? fichier : new File([fichier], nom, { type: fichier.type }),
      dossier,
      onProgress,
    );
    return { url: envoi.url, duration: envoi.duration ?? duree };
  }

  await deposer(fichier, ouverture, onProgress);
  // La source d'un titre ne doit pas avoir d'adresse lisible : voir lib/fichiers.ts.
  const url = dossier === "songs" ? cleSource(ouverture.fichierId) : adresseMedia(ouverture.fichierId);
  return { url, fichierId: ouverture.fichierId, duration: duree };
}
