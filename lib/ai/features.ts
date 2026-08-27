/**
 * Catalogue des fonctionnalités qui appellent l'IA.
 *
 * Un seul endroit décrit, pour chacune : le modèle qu'elle emploie, ce
 * qu'elle a le droit de dépenser, et à quelle cadence un même compte peut
 * la solliciter. Deux raisons de tout regrouper ici plutôt que de laisser
 * ces valeurs dans chaque route.
 *
 * 1. Chaque appel coûte de l'argent. Éparpillés, ces plafonds seraient
 *    invérifiables : personne ne saurait dire, sans relire neuf fichiers,
 *    ce qu'une journée d'usage peut coûter au pire.
 * 2. L'administration affiche cette liste telle quelle pour éteindre une
 *    fonctionnalité en particulier. Une liste dérivée du code ne peut pas
 *    se désynchroniser de ce que le code fait réellement.
 *
 * Le choix du modèle suit une règle simple : `rapide` (Haiku) pour tout ce
 * qui classe, étiquette ou trie — la réponse est courte et attendue tout
 * de suite ; `soigne` (Sonnet) pour tout ce qui rédige un texte qu'un
 * humain va lire et publier.
 */

export type NiveauModele = "rapide" | "soigne";

export type DescriptionFonctionnalite = {
  /** Libellé affiché en administration. */
  label: string;
  /** Ce que la fonctionnalité fait, en une phrase, pour la page de réglages. */
  detail: string;
  niveau: NiveauModele;
  /** Plafond de sortie. Une réponse tronquée vaut mieux qu'une facture ouverte. */
  maxTokens: number;
  /** Cadence maximale pour un même compte. */
  limite: { limit: number; windowMs: number };
  /** Qui peut déclencher l'appel. Sert de garde-fou lisible, pas d'autorisation. */
  acces: "membre" | "artiste" | "admin" | "public";
};

const MINUTE = 60 * 1000;

export const FONCTIONNALITES_IA = {
  chat: {
    label: "Assistant du chat de contact",
    detail: "Répond aux membres à partir des articles du centre d'aide, avant l'équipe.",
    niveau: "soigne",
    maxTokens: 700,
    limite: { limit: 30, windowMs: 15 * MINUTE },
    acces: "membre",
  },
  moderation: {
    label: "Modération des commentaires",
    detail: "Relit les commentaires par lots : ton, insulte, spam. Signale à l'équipe, ne masque jamais.",
    niveau: "rapide",
    // Un lot de dix verdicts complets. Le plafond du catalogue borne la
    // demande de l'appelant, jamais l'inverse : le descendre ici
    // tronquerait les derniers commentaires du lot.
    maxTokens: 1400,
    limite: { limit: 40, windowMs: 10 * MINUTE },
    acces: "admin",
  },
  publication: {
    label: "Aide à la publication d'un titre",
    detail: "Propose genre, tags, langue et description depuis le titre et les paroles.",
    niveau: "soigne",
    maxTokens: 900,
    limite: { limit: 20, windowMs: 15 * MINUTE },
    acces: "artiste",
  },
  playlist: {
    label: "Playlist depuis une description",
    detail: "Compose une playlist en puisant dans le catalogue, à partir d'une phrase.",
    niveau: "soigne",
    maxTokens: 1200,
    limite: { limit: 12, windowMs: 15 * MINUTE },
    acces: "membre",
  },
  recherche: {
    label: "Recherche en langage naturel",
    detail: "Traduit une phrase en critères de recherche, quand la recherche classique ne trouve rien.",
    niveau: "rapide",
    maxTokens: 300,
    limite: { limit: 25, windowMs: 10 * MINUTE },
    acces: "public",
  },
  biographie: {
    label: "Rédaction de biographie d'artiste",
    detail: "Rédige ou reprend la biographie d'un artiste à partir de ses titres et de ses notes.",
    niveau: "soigne",
    maxTokens: 900,
    limite: { limit: 12, windowMs: 15 * MINUTE },
    acces: "artiste",
  },
  aide: {
    label: "Rédaction d'articles d'aide",
    detail: "Rédige un article du centre d'aide à partir de son titre et de quelques notes.",
    niveau: "soigne",
    maxTokens: 1600,
    limite: { limit: 20, windowMs: 15 * MINUTE },
    acces: "admin",
  },
  reponse: {
    label: "Réponse suggérée au support",
    detail: "Prépare une réponse à un fil de support, que l'équipe relit avant d'envoyer.",
    niveau: "soigne",
    maxTokens: 800,
    limite: { limit: 40, windowMs: 15 * MINUTE },
    acces: "admin",
  },
  traduction: {
    label: "Traduction des paroles",
    detail: "Traduit les paroles d'un titre dans la langue de l'auditeur.",
    niveau: "soigne",
    maxTokens: 2000,
    limite: { limit: 15, windowMs: 15 * MINUTE },
    acces: "membre",
  },
} satisfies Record<string, DescriptionFonctionnalite>;

export type IdFonctionnaliteIA = keyof typeof FONCTIONNALITES_IA;

export const IDS_FONCTIONNALITES_IA = Object.keys(FONCTIONNALITES_IA) as IdFonctionnaliteIA[];

export function estIdFonctionnaliteIA(valeur: string): valeur is IdFonctionnaliteIA {
  return Object.prototype.hasOwnProperty.call(FONCTIONNALITES_IA, valeur);
}

/** Plafond d'appels par jour, tous usages confondus, si l'administration n'en fixe pas d'autre. */
export const PLAFOND_JOURNALIER_DEFAUT = 1000;
