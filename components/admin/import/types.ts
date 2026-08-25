import type { MetadonneesAudio } from "@/lib/audioMetadata";

export type ArtisteOption = { _id: string; stageName: string; verified?: boolean };
export type AlbumOption = { _id: string; title: string; type?: string };

export type DoublonDetecte = {
  _id: string;
  title: string;
  status: string;
  artistName: string;
  /** Faux quand l'artiste du fichier n'a pas été reconnu : simple homonymie. */
  certain: boolean;
};

export type StatutLigne = "analyse" | "pret" | "incomplet" | "erreur" | "doublon" | "envoi" | "termine";

/** D'où vient la pochette affichée — l'ordre de préférence du cahier des charges. */
export type SourcePochette = "integree" | "manuelle" | "defaut";

export type LigneImport = {
  id: string;
  fichier: File;
  statut: StatutLigne;
  /** Renseignée quand la lecture des métadonnées a échoué. */
  erreur?: string;

  meta?: MetadonneesAudio;

  // Champs modifiables par l'administration.
  titre: string;
  /** Nom lu dans les balises — sert au rapprochement et reste affiché. */
  artisteNom: string;
  /** Titre d'album lu dans les balises, informatif. */
  album: string;
  albumId: string;
  genre: string;
  annee: string;
  piste: string;
  compositeur: string;

  // Pochette : `apercuPochette` et `pochette` désignent toujours la même
  // image, pour que ce qui est montré soit exactement ce qui sera envoyé.
  sourcePochette: SourcePochette;
  apercuPochette: string | null;
  pochette: File | null;
  /** Conservée pour revenir à la pochette du fichier après un remplacement. */
  pochetteIntegree: { fichier: File; apercu: string; largeur?: number; hauteur?: number } | null;

  artiste: ArtisteOption | null;
  doublon: DoublonDetecte | null;
  /** Le rapprochement serveur (artiste + doublon) a-t-il déjà eu lieu ? */
  inspecte: boolean;
  /** Un doublon n'est importé que si l'administration le demande explicitement. */
  importerMalgreDoublon: boolean;

  apercuAudio: string;
  progression: number;
  songId?: string;
};

export const STATUT_META: Record<StatutLigne, { libelle: string; detail: string; couleur: string }> = {
  analyse: { libelle: "Analyse", detail: "Lecture des métadonnées", couleur: "text-ink-muted" },
  pret: { libelle: "Prêt", detail: "Prêt à importer", couleur: "text-verified" },
  incomplet: { libelle: "À compléter", detail: "Information manquante", couleur: "text-warning" },
  erreur: { libelle: "Erreur", detail: "Fichier inexploitable", couleur: "text-danger" },
  doublon: { libelle: "Doublon", detail: "Déjà au catalogue", couleur: "text-warning" },
  envoi: { libelle: "Envoi", detail: "Transfert en cours", couleur: "text-accent" },
  termine: { libelle: "Importé", detail: "Ajouté au catalogue", couleur: "text-verified" },
};

/**
 * Statut recalculé à chaque modification, plutôt que stocké au fil de
 * l'eau : une ligne « À compléter » doit repasser à « Prêt » dès que
 * l'administration choisit l'artiste, sans dépendre de l'ordre des mises
 * à jour. Les phases transitoires, elles, sont conduites par l'envoi.
 */
export function recalculerStatut(ligne: LigneImport): LigneImport {
  if (ligne.statut === "analyse" || ligne.statut === "envoi" || ligne.statut === "termine") return ligne;

  let statut: StatutLigne = "pret";
  if (ligne.erreur) statut = "erreur";
  else if (!ligne.meta?.duree) statut = "erreur";
  else if (ligne.doublon && !ligne.importerMalgreDoublon) statut = "doublon";
  else if (!ligne.titre.trim() || !ligne.artiste || !ligne.genre.trim()) statut = "incomplet";

  return statut === ligne.statut ? ligne : { ...ligne, statut };
}

/** Une ligne part à l'envoi si, et seulement si, elle est complète. */
export function estImportable(ligne: LigneImport): boolean {
  return ligne.statut === "pret";
}

/**
 * Un fichier peut être refusé pour deux raisons très différentes — balises
 * illisibles, ou durée introuvable alors que les balises sont bonnes. Dire
 * « fichier inexploitable » dans les deux cas laisserait l'administration
 * sans piste, notamment sur un fichier tronqué dont le titre s'affiche
 * pourtant correctement.
 */
export function messageErreur(ligne: LigneImport): string {
  if (ligne.erreur) return ligne.erreur;
  if (!ligne.meta) return "Métadonnées introuvables ou fichier corrompu.";
  if (!ligne.meta.duree) return "Durée introuvable : fichier tronqué, ou sans piste audio décodable.";
  return "Fichier inexploitable.";
}
