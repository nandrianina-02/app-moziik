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

  /* --- Champs suivants : lus pour le formulaire de publication d'un seul
     titre, qui remplit tout ce que le fichier porte. L'import groupé ne
     s'en sert pas ; ils sont donc tous facultatifs et purement additifs. */

  /** Tous les interprètes déclarés, artiste principal compris. */
  artistes?: string[];
  producteur?: string;
  bpm?: number;
  /** Tonalité déclarée, ex. « C#m ». */
  tonalite?: string;
  isrc?: string;
  copyright?: string;
  /** Valeur brute de la balise de langue : souvent un code ISO (« fra », « eng »). */
  langue?: string;
  /**
   * Paroles. Converties en LRC quand le fichier porte des paroles
   * synchronisées : c'est exactement le format que lib/lyrics.ts sait déjà
   * lire, donc elles défilent dans le lecteur sans rien changer au modèle
   * de données.
   */
  paroles?: string;
  /** Vrai si `paroles` est au format LRC horodaté. */
  parolesSynchronisees?: boolean;
  description?: string;
  /** Date de sortie déclarée, normalisée en AAAA-MM-JJ quand elle est complète. */
  dateSortie?: string;
  /** Genres au-delà du premier — le premier alimente le champ Genre. */
  genresSecondaires?: string[];
  /** Regroupement, ambiance et mots-clés : matière à tags. */
  motsCles?: string[];
  /** Renseigné uniquement quand une balise le dit sans ambiguïté. */
  explicite?: boolean;
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

/** Première valeur non vide d'un tableau de chaînes. */
function premiereChaine(valeurs?: (string | undefined)[]): string | undefined {
  return valeurs?.map((v) => v?.trim()).find((v): v is string => !!v);
}

function horodatageLrc(millisecondes: number): string {
  const total = Math.max(0, millisecondes) / 1000;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `[${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}]`;
}

/** Format d'horodatage ID3 : 2 = millisecondes, seul cas exploitable tel quel. */
const HORODATAGE_MS = 2;

type BaliseParoles = {
  text?: string;
  syncText?: { text: string; timestamp?: number }[];
  timeStampFormat?: number;
};

/**
 * Paroles du fichier, en LRC dès qu'elles sont synchronisées.
 *
 * Un horodatage en numéro de trame MPEG (format 1) ne se convertit pas
 * sans connaître la cadence exacte du flux : on retombe alors sur le texte
 * brut plutôt que d'inventer des minutages faux.
 */
function lireParoles(tags: BaliseParoles[] | undefined): { texte?: string; synchronisees: boolean } {
  for (const tag of tags ?? []) {
    const lignes = (tag.syncText ?? []).filter((l) => typeof l.timestamp === "number" && l.text);
    if (lignes.length > 0 && tag.timeStampFormat === HORODATAGE_MS) {
      const texte = lignes
        .map((l) => horodatageLrc(l.timestamp as number) + l.text.replace(/[\r\n]+/g, " ").trim())
        .join("\n");
      return { texte, synchronisees: true };
    }
  }
  return { texte: premiereChaine((tags ?? []).map((t) => t.text)), synchronisees: false };
}

/**
 * Indicateur « contenu explicite ».
 *
 * Il ne figure pas dans les champs communs de music-metadata : chaque
 * conteneur le range ailleurs — atome `rtng` chez Apple, trame
 * `TXXX:ITUNESADVISORY` en ID3v2, commentaire `ITUNESADVISORY` en Vorbis.
 * On ne renvoie une valeur que lorsqu'elle est explicite : un fichier muet
 * sur le sujet ne doit pas cocher la case à la place de l'artiste.
 */
function lireExplicite(natif: Record<string, { id: string; value: unknown }[]> | undefined): boolean | undefined {
  for (const balises of Object.values(natif ?? {})) {
    for (const b of balises) {
      if (!/RTNG|ITUNESADVISORY|ADVISORY|EXPLICIT/.test(b.id.toUpperCase())) continue;
      const brut =
        typeof b.value === "object" && b.value !== null && "value" in b.value
          ? (b.value as { value: unknown }).value
          : b.value;
      const v = String(brut).trim().toLowerCase();
      if (v === "1" || v === "true" || v === "yes" || v === "explicit") return true;
      if (v === "0" || v === "2" || v === "false" || v === "no" || v === "clean") return false;
    }
  }
  return undefined;
}

/**
 * Intervenant d'un rôle donné, lu dans les trames de crédits.
 *
 * music-metadata décode bien la trame IPLS d'un ID3v2.3 — elle arrive dans
 * `native` sous la forme `{ producer: ["…"], engineer: ["…"] }` — mais ne
 * la reporte pas dans `common` : sa table de correspondance ne rattache
 * `IPLS:producer` qu'aux tags v2.4. Or v2.3 reste la version la plus
 * répandue. Sans ce repli, le champ Producteur resterait vide sur la
 * majorité des MP3 qui le renseignent pourtant.
 */
function intervenant(
  natif: Record<string, { id: string; value: unknown }[]> | undefined,
  role: string
): string | undefined {
  for (const balises of Object.values(natif ?? {})) {
    for (const b of balises) {
      if (!/^(IPLS|TIPL|TMCL)$/.test(b.id.toUpperCase())) continue;
      const valeur = b.value as Record<string, unknown> | null;
      if (!valeur || typeof valeur !== "object") continue;
      const trouve = Object.entries(valeur).find(([cle]) => cle.toLowerCase() === role);
      if (!trouve) continue;
      const noms = Array.isArray(trouve[1]) ? trouve[1] : [trouve[1]];
      const premier = noms.map((n) => String(n).trim()).find(Boolean);
      if (premier) return premier;
    }
  }
  return undefined;
}

/** AAAA, AAAA-MM ou AAAA-MM-JJ → AAAA-MM-JJ ; rien si la date est partielle. */
function dateComplete(valeur?: string): string | undefined {
  const m = valeur?.trim().match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
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

  const paroles = lireParoles(commun.lyrics as BaliseParoles[] | undefined);
  const genres = (commun.genre ?? []).map((g) => g.trim()).filter(Boolean);
  const motsCles = [...(commun.keywords ?? []), commun.grouping, commun.mood]
    .map((v) => v?.trim())
    .filter((v): v is string => !!v);

  return {
    titre: commun.title?.trim() || undefined,
    artiste: (commun.artist || commun.albumartist)?.trim() || undefined,
    album: commun.album?.trim() || undefined,
    genre: genres[0] || undefined,
    annee: premierNombre(commun.year),
    piste: premierNombre(commun.track?.no),
    compositeur: commun.composer?.[0]?.trim() || undefined,
    duree: duree && Number.isFinite(duree) ? duree : undefined,
    debit: format.bitrate,
    format: (format.container || format.codec || "").toString().toUpperCase() || undefined,
    pochette,
    nbPochettes: images.length,

    artistes: (commun.artists ?? []).map((a) => a.trim()).filter(Boolean),
    producteur:
      premiereChaine(commun.producer) ??
      intervenant(resultat.native as Record<string, { id: string; value: unknown }[]> | undefined, "producer"),
    bpm: premierNombre(commun.bpm),
    tonalite: commun.key?.trim() || undefined,
    isrc: premiereChaine(commun.isrc),
    copyright: commun.copyright?.trim() || undefined,
    langue: commun.language?.trim() || undefined,
    paroles: paroles.texte,
    parolesSynchronisees: paroles.synchronisees,
    description:
      premiereChaine(commun.description) ||
      premiereChaine((commun.comment ?? []).map((c) => c.text)) ||
      commun.longDescription?.trim() ||
      undefined,
    dateSortie: dateComplete(commun.releasedate) || dateComplete(commun.date) || dateComplete(commun.originaldate),
    genresSecondaires: genres.slice(1),
    motsCles,
    explicite: lireExplicite(resultat.native as Record<string, { id: string; value: unknown }[]> | undefined),
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
