/// <reference lib="webworker" />
import { Mp3Encoder } from "@breezystack/lamejs";

/**
 * Encodage MP3 hors du fil principal : quelques dizaines de secondes de
 * calcul pour un titre, que la page ne doit pas subir figée.
 *
 * Reçoit les échantillons déjà décodés et découpés (le décodage, lui,
 * demande un AudioContext, absent des workers), et renvoie un fichier MP3
 * par débit demandé.
 */

export interface DemandeEncodage {
  canaux: Float32Array[];
  frequence: number;
  versions: { cle: string; debit: number; mono: boolean }[];
}

export type MessageEncodage =
  | { type: "progression"; valeur: number }
  | { type: "termine"; fichiers: Record<string, Uint8Array[]> }
  | { type: "erreur"; message: string };

const BLOC = 1152 * 16;

function versEntiers(source: Float32Array, debut: number, fin: number): Int16Array {
  const sortie = new Int16Array(fin - debut);
  for (let i = debut; i < fin; i += 1) {
    const s = Math.max(-1, Math.min(1, source[i]));
    sortie[i - debut] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return sortie;
}

/** Mélange les canaux en un seul : la version légère est en mono. */
function mixer(canaux: Float32Array[]): Float32Array {
  if (canaux.length === 1) return canaux[0];
  const mono = new Float32Array(canaux[0].length);
  for (let i = 0; i < mono.length; i += 1) mono[i] = (canaux[0][i] + canaux[1][i]) / 2;
  return mono;
}

self.onmessage = (event: MessageEvent<DemandeEncodage>) => {
  const { canaux, frequence, versions } = event.data;
  try {
    const longueur = canaux[0]?.length ?? 0;
    const total = longueur * versions.length;
    const fichiers: Record<string, Uint8Array[]> = {};
    let fait = 0;
    let dernier = 0;

    for (const version of versions) {
      const stereo = !version.mono && canaux.length > 1;
      const gauche = stereo ? canaux[0] : mixer(canaux);
      const droite = stereo ? canaux[1] : null;
      const encodeur = new Mp3Encoder(stereo ? 2 : 1, frequence, version.debit);
      const parties: Uint8Array[] = [];

      for (let debut = 0; debut < longueur; debut += BLOC) {
        const fin = Math.min(debut + BLOC, longueur);
        const trame = droite
          ? encodeur.encodeBuffer(versEntiers(gauche, debut, fin), versEntiers(droite, debut, fin))
          : encodeur.encodeBuffer(versEntiers(gauche, debut, fin));
        if (trame.length > 0) parties.push(new Uint8Array(trame));
        fait += fin - debut;
        const avancement = fait / total;
        if (avancement - dernier >= 0.01) {
          dernier = avancement;
          (self as unknown as Worker).postMessage({ type: "progression", valeur: avancement } satisfies MessageEncodage);
        }
      }
      const reste = encodeur.flush();
      if (reste.length > 0) parties.push(new Uint8Array(reste));
      fichiers[version.cle] = parties;
    }

    (self as unknown as Worker).postMessage({ type: "termine", fichiers } satisfies MessageEncodage);
  } catch (erreur) {
    (self as unknown as Worker).postMessage({
      type: "erreur",
      message: erreur instanceof Error ? erreur.message : "Encodage impossible.",
    } satisfies MessageEncodage);
  }
};
