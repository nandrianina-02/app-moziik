/**
 * Pourquoi ce morceau-là.
 *
 * Chaque titre proposé par une station porte un motif : ce qui l'a fait
 * entrer dans la file. C'est la partie « explication des
 * recommandations », et elle est traitée comme une **donnée**, pas comme
 * une phrase.
 *
 * La distinction n'est pas cosmétique. Une explication rédigée par le
 * modèle serait invérifiable — il écrirait une raison plausible plutôt
 * que la vraie — et disparaîtrait avec la clé d'API. Ici le moteur émet
 * un motif structuré, que ce fichier rend en français. La raison affichée
 * est donc, littéralement, celle qui a présidé au choix.
 *
 * N'importe RIEN : la file s'affiche dans le navigateur.
 */

export type Motif =
  /** Un artiste que l'auditeur écoute déjà. */
  | { type: "artiste_aime"; artiste: string }
  /** Un genre qui revient dans ses écoutes. */
  | { type: "genre_habituel"; genre: string }
  /** Proche d'un titre qu'il a aimé ou beaucoup écouté. */
  | { type: "voisin"; titre: string; artiste: string }
  /** Il l'a aimé explicitement. */
  | { type: "favori" }
  /** Réécoute d'un titre qu'il connaît. */
  | { type: "deja_ecoute"; fois: number }
  /** Hors de ses habitudes, proposé pour élargir. */
  | { type: "decouverte"; genre: string }
  /** Retenu pour le moment de la journée. */
  | { type: "moment"; label: string }
  /** Faute d'historique : ce que tout le monde écoute. */
  | { type: "populaire" };

/** La raison, en une phrase, telle qu'elle s'affiche sous le titre. */
export function libelleMotif(motif: Motif): string {
  switch (motif.type) {
    case "artiste_aime":
      return `Vous écoutez ${motif.artiste}`;
    case "genre_habituel":
      return `Vous écoutez beaucoup de ${motif.genre}`;
    case "voisin":
      return `Proche de « ${motif.titre} » de ${motif.artiste}`;
    case "favori":
      return "Dans vos favoris";
    case "deja_ecoute":
      return motif.fois > 1 ? `Déjà écouté ${motif.fois} fois` : "Déjà écouté";
    case "decouverte":
      return `À découvrir — ${motif.genre}`;
    case "moment":
      return motif.label;
    case "populaire":
      return "Très écouté en ce moment";
  }
}

/**
 * Familles de provenance, pour équilibrer une file.
 *
 * Une station qui n'enchaîne que du connu lasse ; une station qui
 * n'enchaîne que de l'inconnu se fait couper. Le moteur dose les trois
 * (voir lib/taste/station.ts) et cette fonction dit à quelle famille
 * appartient un motif.
 */
export type Famille = "familier" | "voisin" | "decouverte";

export function familleDuMotif(motif: Motif): Famille {
  switch (motif.type) {
    // « Familier » dit que le TITRE est connu, pas son auteur. Un morceau
    // inédit d'un artiste écouté tous les jours reste une découverte de
    // proximité : le ranger avec les réécoutes ferait mentir le dosage
    // que lib/taste/station.ts calcule à partir de ces familles.
    case "favori":
    case "deja_ecoute":
      return "familier";
    case "artiste_aime":
    case "voisin":
    case "genre_habituel":
    case "moment":
      return "voisin";
    case "decouverte":
    case "populaire":
      return "decouverte";
  }
}
