import type { AudioQuality } from "@/lib/offlineSettings";
import { decoder, encoderVersions, type Decoupe } from "@/lib/encodageAudio";
import { envoyerFichier } from "@/lib/envoiFichier";

/**
 * Envoi d'un titre : le fichier d'origine, puis ses trois qualités d'écoute
 * encodées dans le navigateur (voir lib/encodageAudio.ts).
 *
 * L'origine est gardée telle quelle, sans découpe : c'est d'elle que l'on
 * repart quand la découpe change, et c'est elle que l'éditeur de découpe
 * fait entendre. Le public n'entend que les versions encodées.
 */

export interface TitreEnvoye {
  /** Clé de la source (`ks:…`), ou URL Cloudinary en repli. */
  audioUrl: string;
  /** Identifiants des trois qualités ; absent en repli Cloudinary. */
  audioVariantes?: Record<AudioQuality, string>;
  duration?: number;
}

/** Les étapes, pour un message lisible pendant l'attente. */
export type EtapeTitre = "source" | "encodage" | "versions";

async function modeStockage(): Promise<"karaks-storage" | "cloudinary"> {
  const reponse = await fetch("/api/fichiers/envoi", { cache: "no-store" }).catch(() => null);
  const donnees = await reponse?.json().catch(() => null);
  return donnees?.mode === "karaks-storage" ? "karaks-storage" : "cloudinary";
}

/**
 * Encode puis envoie les trois qualités d'une source déjà en mémoire.
 * Sert aussi quand seule la découpe change : rien n'est renvoyé de la source.
 */
export async function envoyerVersions(
  source: Blob,
  decoupe: Decoupe,
  nom: string,
  onProgress?: (pourcent: number) => void,
  onEtape?: (etape: EtapeTitre) => void,
): Promise<{ variantes: Record<AudioQuality, string>; duree: number }> {
  onEtape?.("encodage");
  const { canaux, duree } = await decoder(source, decoupe);
  const versions = await encoderVersions(canaux, (v) => onProgress?.(Math.round(v * 60)));

  onEtape?.("versions");
  const base = nom.replace(/\.[A-Za-z0-9]{1,8}$/, "") || "titre";
  const tailles = Object.values(versions).reduce((somme, blob) => somme + blob.size, 0);
  let envoye = 0;
  const variantes = {} as Record<AudioQuality, string>;
  for (const [qualite, blob] of Object.entries(versions) as [AudioQuality, Blob][]) {
    const envoi = await envoyerFichier(blob, "songs", (p) => onProgress?.(60 + Math.round(((envoye + (blob.size * p) / 100) / tailles) * 40)), {
      nom: `${base}-${qualite}.mp3`,
    });
    if (!envoi.fichierId) throw new Error("Le stockage des titres n'est plus disponible : réessaie dans un instant.");
    variantes[qualite] = envoi.fichierId;
    envoye += blob.size;
  }
  return { variantes, duree };
}

export async function envoyerTitre(
  fichier: File,
  decoupe: Decoupe,
  onProgress?: (pourcent: number) => void,
  onEtape?: (etape: EtapeTitre) => void,
): Promise<TitreEnvoye> {
  if ((await modeStockage()) === "cloudinary") {
    const envoi = await envoyerFichier(fichier, "songs", onProgress);
    return { audioUrl: envoi.url, duration: envoi.duration };
  }

  // La source compte pour un tiers de la barre, l'encodage et les versions
  // pour le reste : c'est à peu près la part de chacun dans l'attente.
  onEtape?.("source");
  const source = await envoyerFichier(fichier, "songs", (p) => onProgress?.(Math.round(p / 3)));
  const { variantes, duree } = await envoyerVersions(
    fichier,
    decoupe,
    fichier.name,
    (p) => onProgress?.(33 + Math.round((p * 67) / 100)),
    onEtape,
  );
  return { audioUrl: source.url, audioVariantes: variantes, duration: source.duration ?? duree };
}
