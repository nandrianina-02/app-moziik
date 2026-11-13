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
  lireEtiquettes: "fichier:etiquettes",
  lireFichier: "fichier:lire",
  reglagesLire: "reglages:lire",
  reglagesEcrire: "reglages:ecrire",
  coffreLire: "coffre:lire",
  coffreEcrire: "coffre:ecrire",
  ouvrirExterne: "systeme:ouvrir",
  version: "systeme:version",
} as const;
