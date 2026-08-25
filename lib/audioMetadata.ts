/**
 * Lecture des métadonnées d'un fichier audio, côté navigateur.
 *
 * Sert à l'import groupé de l'administration : chaque fichier déposé est
 * analysé localement — aucun octet n'est envoyé au serveur tant que
 * l'administrateur n'a pas validé.
 *
 * `music-metadata` couvre les conteneurs utilisés par le projet :
 *   MP3   → ID3v1 / ID3v2 (image dans une frame APIC)
 *   FLAC  → bloc PICTURE
 *   M4A / AAC → atome « covr »
 *   OGG   → METADATA_BLOCK_PICTURE encodé en base64 dans les commentaires
 *   WAV   → chunk LIST/INFO (rarement porteur d'image)
 * Écrire ces quatre analyseurs à la main serait beaucoup de surface pour
 * peu de valeur : la bibliothèque est chargée dynamiquement, donc absente
 * du bundle tant que la page d'import n'est pas ouverte.
 */

export type PochetteIntegree = {
  /** Fichier image reconstruit depuis les métadonnées, prêt à être envoyé. */
  fichier: File;
  /** URL d'objet pour l'aperçu — à révoquer avec `libererPochette`. */
  apercu: string;
  typeMime: string;
  octets: number;
  /** Dimensions réelles, décodées : c'est ce qui définit « la meilleure qualité ». */
  largeur?: number;
  hauteur?: number;
};

export type MetadonneesAudio = {
  titre?: string;
  artiste?: string;
  album?: string;
  genre?: string;
  annee?: number;
  piste?: number;
  compositeur?: string;
  /** En secondes. */
  duree?: number;
  /** En bits par seconde. */
  debit?: number;
  /** Conteneur lisible, ex. « MP3 », « FLAC ». */
  format?: string;
  pochette: PochetteIntegree | null;
  /** Nombre d'images trouvées — l'aperçu n'en montre qu'une. */
  nbPochettes: number;
};

const EXTENSIONS_ACCEPTEES = /\.(mp3|wav|flac|m4a|aac|mp4|ogg|oga|opus)$/i;

export function estFichierAudio(fichier: File): boolean {
  return fichier.type.startsWith("audio/") || EXTENSIONS_ACCEPTEES.test(fichier.name);
}

/** Nom de fichier sans extension — repli de titre quand la balise manque. */
export function titreDepuisNomDeFichier(nom: string): string {
  return nom.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim();
}

const EXT_PAR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
};

/**
 * Dimensions réelles d'une image, par décodage.
 * `createImageBitmap` est le chemin rapide ; le repli par <img> couvre les
 * navigateurs qui refusent certains types (BMP notamment).
 */
async function dimensions(blob: Blob): Promise<{ largeur: number; hauteur: number } | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      const taille = { largeur: bitmap.width, hauteur: bitmap.height };
      bitmap.close?.();
      return taille;
    } catch {
      /* on tente le repli */
    }
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ largeur: img.naturalWidth, hauteur: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/**
 * Un fichier peut embarquer plusieurs images (face avant, dos, livret...).
 * On garde la plus définie : surface en pixels d'abord — c'est le vrai
 * critère de qualité — puis poids, et enfin la préférence « face avant »
 * pour départager deux images de même définition.
 */
async function meilleurePochette(
  images: { format: string; data: Uint8Array; type?: string }[],
  nomDeBase: string
): Promise<PochetteIntegree | null> {
  const candidates = await Promise.all(
    images.map(async (img) => {
      const typeMime = img.format || "image/jpeg";
      // Uint8Array<ArrayBufferLike> ne satisfait pas BlobPart depuis TS 5.7 :
      // on recopie dans un ArrayBuffer propre, ce qui détache aussi l'image
      // du tampon d'analyse (libéré dès que possible).
      const octets = new Uint8Array(img.data.byteLength);
      octets.set(img.data);
      const blob = new Blob([octets.buffer], { type: typeMime });
      const taille = await dimensions(blob);
      return {
        blob,
        typeMime,
        estFaceAvant: /front|cover \(front\)/i.test(img.type ?? ""),
        surface: taille ? taille.largeur * taille.hauteur : 0,
        largeur: taille?.largeur,
        hauteur: taille?.hauteur,
      };
    })
  );

  const valides = candidates.filter((c) => c.blob.size > 0);
  if (valides.length === 0) return null;

  valides.sort(
    (a, b) =>
      b.surface - a.surface ||
      b.blob.size - a.blob.size ||
      Number(b.estFaceAvant) - Number(a.estFaceAvant)
  );

  const gagnante = valides[0];
  const extension = EXT_PAR_MIME[gagnante.typeMime.toLowerCase()] ?? "jpg";
  return {
    fichier: new File([gagnante.blob], `${nomDeBase}-pochette.${extension}`, { type: gagnante.typeMime }),
    apercu: URL.createObjectURL(gagnante.blob),
    typeMime: gagnante.typeMime,
    octets: gagnante.blob.size,
    largeur: gagnante.largeur,
    hauteur: gagnante.hauteur,
  };
}

/**
 * Durée de repli, quand l'en-tête ne la porte pas : un MP3 à débit variable
 * sans en-tête Xing, par exemple. Le navigateur la déduit du décodage.
 */
function dureeParLeNavigateur(fichier: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(fichier);
    const audio = new Audio();
    const fin = (valeur?: number) => {
      URL.revokeObjectURL(url);
      resolve(valeur);
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () => fin(Number.isFinite(audio.duration) ? audio.duration : undefined);
    audio.onerror = () => fin(undefined);
    // Un fichier corrompu peut ne déclencher aucun événement.
    setTimeout(() => fin(undefined), 12000);
    audio.src = url;
  });
}

function premierNombre(valeur: unknown): number | undefined {
  if (typeof valeur === "number" && Number.isFinite(valeur)) return valeur;
  if (typeof valeur === "string") {
    const n = parseInt(valeur, 10);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export async function lireMetadonneesAudio(fichier: File): Promise<MetadonneesAudio> {
  const { parseBlob } = await import("music-metadata");
  // `duration: false` évite de parcourir tout le fichier pour un MP3 sans
  // en-tête Xing ; quand la durée manque, le repli navigateur la donne.
  const resultat = await parseBlob(fichier, { duration: false });
  const commun = resultat.common;
  const format = resultat.format;

  const images = (commun.picture ?? []) as { format: string; data: Uint8Array; type?: string }[];
  const pochette = images.length > 0 ? await meilleurePochette(images, titreDepuisNomDeFichier(fichier.name)) : null;

  let duree = format.duration;
  if (!duree || !Number.isFinite(duree) || duree <= 0) duree = await dureeParLeNavigateur(fichier);

  return {
    titre: commun.title?.trim() || undefined,
    artiste: (commun.artist || commun.albumartist)?.trim() || undefined,
    album: commun.album?.trim() || undefined,
    genre: commun.genre?.[0]?.trim() || undefined,
    annee: premierNombre(commun.year),
    piste: premierNombre(commun.track?.no),
    compositeur: commun.composer?.[0]?.trim() || undefined,
    duree: duree && Number.isFinite(duree) ? duree : undefined,
    debit: format.bitrate,
    format: (format.container || format.codec || "").toString().toUpperCase() || undefined,
    pochette,
    nbPochettes: images.length,
  };
}

export function libererPochette(pochette: PochetteIntegree | null | undefined) {
  if (pochette) URL.revokeObjectURL(pochette.apercu);
}

export function formaterOctets(octets: number): string {
  if (octets <= 0) return "0 o";
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

export function formaterDuree(secondes?: number): string {
  if (!secondes || !Number.isFinite(secondes)) return "--:--";
  const m = Math.floor(secondes / 60);
  const s = Math.floor(secondes % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
