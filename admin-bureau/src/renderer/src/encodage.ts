import type { DemandeEncodage, MessageEncodage } from "./encodage.worker";

/*
 * Les trois qualités d'écoute d'un titre, comme le site les fabrique
 * (lib/encodageAudio.ts) : Karaks Storage sert les fichiers tels quels, sans
 * transcodage, donc chaque qualité est un fichier à part, encodé ici une
 * fois pour toutes. Le lecteur choisit ensuite selon l'abonnement et le
 * réglage de qualité de l'auditeur.
 */

export type Qualite = "low" | "medium" | "high";

export const VERSIONS: { cle: Qualite; debit: number; mono: boolean }[] = [
  // 64 kb/s en stéréo sonne métallique ; en mono, l'écoute reste correcte
  // sur un forfait mobile limité.
  { cle: "low", debit: 64, mono: true },
  { cle: "medium", debit: 128, mono: false },
  { cle: "high", debit: 320, mono: false },
];

/** Celle du CD, acceptée par tous les lecteurs MP3. */
const FREQUENCE = 44_100;

/** Décode un fichier audio entier, à 44,1 kHz. */
export async function decoder(source: Blob): Promise<Float32Array[]> {
  // Un contexte hors ligne ne joue rien : il sert seulement à décoder, et
  // impose sa fréquence au résultat.
  const contexte = new OfflineAudioContext(2, FREQUENCE, FREQUENCE);
  let tampon: AudioBuffer;
  try {
    tampon = await contexte.decodeAudioData(await source.arrayBuffer());
  } catch {
    throw new Error("Format illisible pour l'encodeur (essayez MP3, M4A, FLAC ou WAV).");
  }
  const canaux: Float32Array[] = [];
  for (let c = 0; c < Math.min(2, tampon.numberOfChannels); c += 1) canaux.push(tampon.getChannelData(c).slice());
  return canaux;
}

/** Encode les trois qualités hors du fil principal. `surProgression` reçoit une valeur entre 0 et 1. */
export function encoderVersions(canaux: Float32Array[], surProgression?: (valeur: number) => void): Promise<Record<Qualite, Blob>> {
  return new Promise((resoudre, rejeter) => {
    const worker = new Worker(new URL("./encodage.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (evenement: MessageEvent<MessageEncodage>) => {
      const message = evenement.data;
      if (message.type === "progression") surProgression?.(message.valeur);
      else if (message.type === "erreur") {
        worker.terminate();
        rejeter(new Error(message.message));
      } else {
        worker.terminate();
        const fichiers = {} as Record<Qualite, Blob>;
        for (const v of VERSIONS) fichiers[v.cle] = new Blob(message.fichiers[v.cle] as BlobPart[], { type: "audio/mpeg" });
        resoudre(fichiers);
      }
    };
    worker.onerror = (evenement) => {
      worker.terminate();
      rejeter(new Error(evenement.message || "L'encodage a échoué."));
    };
    const demande: DemandeEncodage = { canaux, frequence: FREQUENCE, versions: VERSIONS };
    worker.postMessage(demande, canaux.map((canal) => canal.buffer));
  });
}
