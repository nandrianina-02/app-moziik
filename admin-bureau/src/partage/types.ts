/*
 * Ce que le processus principal (Node) et la fenêtre (React) se disent, par
 * le pont du preload. Un seul endroit pour ces formes : les deux côtés
 * compilent contre lui.
 */

export interface FichierAudio {
  chemin: string;
  nom: string;
  taille: number;
}

export interface PochetteLue {
  mime: string;
  /** Octets de l'image, en base64 : le pont ne transporte pas de Buffer. */
  base64: string;
  largeur?: number;
  hauteur?: number;
}

/** Les balises d'un fichier, telles que music-metadata les lit. */
export interface Etiquettes {
  titre: string | null;
  artiste: string | null;
  album: string | null;
  annee: number | null;
  piste: number | null;
  genre: string | null;
  compositeur: string | null;
  bpm: number | null;
  /** Durée en secondes. */
  duree: number | null;
  debit: number | null;
  pochette: PochetteLue | null;
  /*
   * Ce que le formulaire de publication du site remplit aussi depuis le
   * fichier (lib/audioMetadata.ts) : tout est facultatif.
   */
  /** Tous les interprètes déclarés, artiste principal compris. */
  artistes?: string[];
  producteur?: string | null;
  tonalite?: string | null;
  isrc?: string | null;
  copyright?: string | null;
  /** Valeur brute : souvent un code ISO (« fra », « eng »). */
  langue?: string | null;
  /** En LRC quand le fichier porte des paroles synchronisées. */
  paroles?: string | null;
  parolesSynchronisees?: boolean;
  description?: string | null;
  /** AAAA-MM-JJ ; une année seule vaut le 1er janvier. */
  dateSortie?: string | null;
  genresSecondaires?: string[];
  /** Regroupement, ambiance, mots-clés : matière à tags. */
  motsCles?: string[];
  /** Seulement quand une balise le dit sans ambiguïté. */
  explicite?: boolean | null;
}

export interface Reglages {
  /** Adresse du site, sans barre finale. */
  site: string;
}

export const SITE_PAR_DEFAUT = "https://app-moziik.vercel.app";

/** Les canaux IPC, nommés une fois. */
export const CANAUX = {
  choisirDossier: "dossier:choisir",
  listerAudio: "dossier:lister-audio",
  choisirFichiers: "fichiers:choisir",
  resoudreChemins: "fichiers:resoudre",
  choisirImage: "image:choisir",
  lireImage: "image:lire",
  choisirVideo: "video:choisir",
  decrireVideo: "video:decrire",
  lireEtiquettes: "fichier:etiquettes",
  lireFichier: "fichier:lire",
  reglagesLire: "reglages:lire",
  reglagesEcrire: "reglages:ecrire",
  coffreLire: "coffre:lire",
  coffreEcrire: "coffre:ecrire",
  ouvrirExterne: "systeme:ouvrir",
  version: "systeme:version",
  installerMiseAJour: "maj:installer",
  progressionMiseAJour: "maj:progression",
} as const;

/** Seules les versions du logiciel publiées sur le dépôt du projet s'installent depuis le logiciel. */
export const PREFIXE_MISE_A_JOUR = "https://github.com/nandrianina-02/app-moziik/releases/download/admin-v";
