import type { AudioQuality } from "@/lib/offlineSettings";
import type { DemandeEncodage, MessageEncodage } from "@/lib/encodageAudio.worker";

/**
 * Les trois qualités d'écoute d'un titre, fabriquées dans le navigateur de
 * l'artiste au moment de l'envoi.
 *
 * Cloudinary les calculait à la demande ; Karaks Storage sert les fichiers
 * tels quels et ne transcode pas (pas de ffmpeg dans une fonction Vercel).
 * Plutôt que d'ajouter un serveur de transcodage, chaque qualité est un
 * fichier à part, encodé ici une fois pour toutes, découpe comprise : le
 * serveur n'a plus qu'à choisir le bon fichier selon l'abonnement.
 */

export const VERSIONS: { cle: AudioQuality; debit: number; mono: boolean }[] = [
  // 64 kb/s en stéréo sonne métallique ; en mono, c'est une écoute correcte
  // sur un forfait mobile limité.
  { cle: "low", debit: 64, mono: true },
  { cle: "medium", debit: 128, mono: false },
  { cle: "high", debit: 320, mono: false },
];

/** Fréquence d'échantillonnage commune : celle du CD, acceptée par tous les lecteurs MP3. */
const FREQUENCE = 44_100;

export interface Decoupe {
  debut: number | null;
  fin: number | null;
}

/** Décode un fichier audio, à 44,1 kHz, et ne garde que la portion retenue. */
export async function decoder(source: Blob, decoupe: Decoupe): Promise<{ canaux: Float32Array[]; duree: number }> {
  const Contexte = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  // Un contexte hors ligne ne joue rien : il sert seulement à décoder, et
  // impose sa fréquence au résultat.
  const contexte = new Contexte(2, FREQUENCE, FREQUENCE);
  let tampon: AudioBuffer;
  try {
    tampon = await contexte.decodeAudioData(await source.arrayBuffer());
  } catch {
    throw new Error("Ce fichier audio n'a pas pu être lu par le navigateur. Essaie un MP3 ou un WAV.");
  }

  const debut = Math.max(0, Math.floor((decoupe.debut ?? 0) * tampon.sampleRate));
  const fin = Math.min(tampon.length, decoupe.fin ? Math.ceil(decoupe.fin * tampon.sampleRate) : tampon.length);
  if (fin - debut < tampon.sampleRate) throw new Error("La portion retenue fait moins d'une seconde.");

  const canaux: Float32Array[] = [];
  for (let c = 0; c < Math.min(2, tampon.numberOfChannels); c += 1) {
    canaux.push(tampon.getChannelData(c).slice(debut, fin));
  }
  return { canaux, duree: tampon.duration };
}

/** Encode les trois qualités. `onProgress` reçoit une valeur entre 0 et 1. */
export function encoderVersions(
  canaux: Float32Array[],
  onProgress?: (valeur: number) => void,
): Promise<Record<AudioQuality, Blob>> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./encodageAudio.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<MessageEncodage>) => {
      const message = event.data;
      if (message.type === "progression") onProgress?.(message.valeur);
      else if (message.type === "erreur") {
        worker.terminate();
        reject(new Error(message.message));
      } else {
        worker.terminate();
        const fichiers = {} as Record<AudioQuality, Blob>;
        for (const version of VERSIONS) {
          fichiers[version.cle] = new Blob(message.fichiers[version.cle] as BlobPart[], { type: "audio/mpeg" });
        }
        resolve(fichiers);
      }
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || "L'encodage a échoué."));
    };
    const demande: DemandeEncodage = { canaux, frequence: FREQUENCE, versions: VERSIONS };
    worker.postMessage(demande, canaux.map((canal) => canal.buffer));
  });
}
