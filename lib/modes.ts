import type { Univers } from "@/lib/univers";

/**
 * Les modes d'écoute : ce qu'on fait pendant qu'on écoute.
 *
 * Un mode n'est pas un genre. « Sport » n'est pas un style de musique,
 * c'est une situation — et la même situation se remplit différemment
 * selon le répertoire : le sport en gospel existe, le voyage en gospel
 * aussi. Mode et univers (lib/univers.ts) sont donc deux axes
 * indépendants qui se croisent : Voyage + Général, Voyage + Évangélique.
 *
 * CE FICHIER N'IMPORTE RIEN DE MONGOOSE, ET C'EST VOULU
 *
 * Le sélecteur de mode vit dans le navigateur, les recettes vivent côté
 * base, et l'écran d'administration a besoin des mêmes libellés. C'est la
 * même raison qui isole lib/univers.ts, lib/curation/labels.ts et
 * lib/ai/labels.ts.
 *
 * CHAQUE MODE SE MESURE, IL NE SE DEVINE PAS
 *
 * Un mode se définit par ce que la base sait réellement d'un titre : son
 * tempo, son genre, ses mots-clés, sa durée, et — pour « Matin » et
 * « Nuit » — l'heure à laquelle on l'écoute effectivement. C'est ce qui
 * distingue une sélection vérifiable d'une ambiance décrétée : on peut
 * demander à n'importe quelle playlist pourquoi ce titre y figure, et la
 * réponse est un chiffre.
 *
 * Aucun mot-clé n'est obligatoire. La moitié du catalogue n'a ni `bpm`
 * ni `tags` ; exiger l'un ou l'autre reviendrait à ne proposer que les
 * morceaux dont la fiche est bien remplie, ce qui n'a rien à voir avec
 * l'ambiance recherchée.
 */

export const MODES = [
  "voyage",
  "sport",
  "etude",
  "travail",
  "sommeil",
  "relaxation",
  "romance",
  "fete",
  "matin",
  "nuit",
  "decouverte",
  "tendance",
] as const;

export type Mode = (typeof MODES)[number];

/**
 * Comment un mode se remplit.
 *
 * `ambiance`  : tempo, mots-clés, durée — ce que le titre est.
 * `horaire`   : l'heure à laquelle le public l'écoute réellement.
 * `decouverte`: peu écouté mais bien terminé, et récent.
 * `tendance`  : en progression d'une semaine sur l'autre.
 */
export type StrategieMode = "ambiance" | "horaire" | "decouverte" | "tendance";

export type DescriptionMode = {
  label: string;
  /** Ce que le mode sélectionne, en une phrase, pour l'administration. */
  detail: string;
  /** Consigne donnée au modèle pour qu'il nomme les playlists du mode. */
  intention: string;
  strategie: StrategieMode;
  /**
   * Tempo recherché. Départage seulement : un titre sans `bpm` n'est
   * jamais écarté pour autant.
   */
  bpm?: { min: number; max: number };
  /** Genres, mots-clés et mots de titre qui rapprochent un morceau du mode. */
  motsCles?: string[];
  /**
   * Fenêtre horaire d'écoute, en heures locales du site. Bornes incluses,
   * et une fenêtre qui passe minuit se lit à l'envers (22 → 5).
   */
  heures?: { de: number; a: number };
  /** Durée attendue, en secondes. Départage, comme le tempo. */
  duree?: { min: number; max: number };
  /** Vrai quand un morceau explicite n'a rien à faire là (sommeil, travail, étude). */
  eviteExplicite?: boolean;
};

export const MODES_INFO: Record<Mode, DescriptionMode> = {
  voyage: {
    label: "Voyage",
    detail: "Tempo moyen, morceaux qui tiennent la route, assez longs pour ne pas hacher le trajet.",
    intention: "de quoi accompagner un long trajet, sans lasser ni endormir",
    strategie: "ambiance",
    bpm: { min: 90, max: 125 },
    motsCles: ["voyage", "route", "road", "evasion", "horizon", "travel", "lalana", "aventure"],
    duree: { min: 180, max: 420 },
  },
  sport: {
    label: "Sport",
    detail: "Tempo élevé et régulier, morceaux qui soutiennent l'effort.",
    intention: "de quoi soutenir un effort physique, rythme tenu du début à la fin",
    strategie: "ambiance",
    bpm: { min: 130, max: 175 },
    motsCles: ["sport", "workout", "energie", "running", "gym", "afrobeat", "amapiano", "dancehall"],
    duree: { min: 150, max: 330 },
  },
  etude: {
    label: "Étude / Concentration",
    detail: "Tempo lent, peu de rupture, rien d'explicite : de quoi rester en fond.",
    intention: "de quoi travailler ou réviser sans que la musique prenne le dessus",
    strategie: "ambiance",
    bpm: { min: 60, max: 95 },
    motsCles: ["instrumental", "piano", "acoustique", "lofi", "ambient", "concentration", "focus", "calme"],
    eviteExplicite: true,
  },
  travail: {
    label: "Travail",
    detail: "Tempo modéré, ambiance continue, rien d'explicite.",
    intention: "de quoi accompagner une journée de travail sans occuper toute l'attention",
    strategie: "ambiance",
    bpm: { min: 85, max: 115 },
    motsCles: ["chill", "lounge", "jazz", "bossa", "instrumental", "groove", "smooth", "acoustique"],
    eviteExplicite: true,
  },
  sommeil: {
    label: "Sommeil",
    detail: "Les tempos les plus lents du catalogue, rien d'explicite.",
    intention: "de quoi s'endormir, très calme, sans montée ni surprise",
    strategie: "ambiance",
    bpm: { min: 50, max: 80 },
    motsCles: ["berceuse", "sommeil", "sleep", "lullaby", "ambient", "piano", "douceur", "calme"],
    eviteExplicite: true,
  },
  relaxation: {
    label: "Relaxation",
    detail: "Tempo lent à moyen, ambiances posées.",
    intention: "de quoi se détendre, posé sans être endormant",
    strategie: "ambiance",
    bpm: { min: 60, max: 95 },
    motsCles: ["relax", "chill", "zen", "detente", "acoustique", "reggae", "bossa", "douceur"],
  },
  romance: {
    label: "Romance",
    detail: "Ballades et morceaux d'amour, tempo lent à moyen.",
    intention: "des morceaux d'amour, à écouter à deux",
    strategie: "ambiance",
    bpm: { min: 60, max: 105 },
    motsCles: ["amour", "love", "romance", "ballade", "slow", "tendresse", "fitiavana", "tiako", "couple"],
  },
  fete: {
    label: "Fête",
    detail: "Les tempos les plus élevés et les genres qui font danser.",
    intention: "de quoi lancer une soirée et la tenir",
    strategie: "ambiance",
    bpm: { min: 118, max: 165 },
    motsCles: ["fete", "party", "dance", "club", "salegy", "afrobeat", "amapiano", "dancehall", "kawitry", "tsapiky", "dihy"],
  },
  matin: {
    label: "Matin",
    detail: "Les titres que le public écoute effectivement le matin, entre 5 h et 11 h.",
    intention: "de quoi démarrer la journée, sans brusquer",
    strategie: "horaire",
    heures: { de: 5, a: 10 },
    bpm: { min: 85, max: 115 },
  },
  nuit: {
    label: "Nuit",
    detail: "Les titres que le public écoute effectivement la nuit, entre 22 h et 5 h.",
    intention: "de quoi écouter tard, plus calme",
    strategie: "horaire",
    heures: { de: 22, a: 4 },
    bpm: { min: 55, max: 100 },
  },
  decouverte: {
    label: "Découverte",
    detail: "Peu écoutés mais écoutés jusqu'au bout : ce que le catalogue cache.",
    intention: "des morceaux peu connus que ceux qui les lancent écoutent jusqu'au bout",
    strategie: "decouverte",
  },
  tendance: {
    label: "Tendance",
    detail: "Les titres dont l'écoute progresse le plus d'une semaine sur l'autre.",
    intention: "ce qui décolle en ce moment",
    strategie: "tendance",
  },
};

/** Nom du cookie qui porte le mode actif, résolu (jamais « auto »). */
export const COOKIE_MODE = "moziik-mode";
/** Clé locale qui retient si l'auditeur a choisi un mode ou laissé l'heure décider. */
export const CLE_MODE_CHOIX = "moziik-mode-choix";
/** Un an, comme l'univers : ce n'est pas une préférence de session. */
export const COOKIE_MODE_MAX_AGE = 365 * 24 * 60 * 60;

/** Mode servi à qui n'a rien choisi, si l'heure locale n'est pas connue. */
export const MODE_PAR_DEFAUT: Mode = "tendance";

export function estMode(valeur: unknown): valeur is Mode {
  return typeof valeur === "string" && (MODES as readonly string[]).includes(valeur);
}

export function normaliserMode(valeur: unknown, defaut: Mode = MODE_PAR_DEFAUT): Mode {
  return estMode(valeur) ? valeur : defaut;
}

export function libelleMode(mode: Mode): string {
  return MODES_INFO[mode].label;
}

/**
 * Le mode déduit de l'heure locale, pour qui laisse faire.
 *
 * Volontairement pauvre : trois créneaux seulement, ceux dont l'heure dit
 * réellement quelque chose. Prétendre déduire « Sport » ou « Romance »
 * d'une horloge serait une invention — ces modes-là se choisissent.
 */
export function modeDeLHeure(heure: number): Mode {
  const h = Math.max(0, Math.min(23, Math.floor(heure)));
  if (h >= 22 || h < 5) return "nuit";
  if (h < 11) return "matin";
  // Le reste de la journée n'indique rien de particulier : on sert ce qui
  // monte, qui est le défaut le plus défendable.
  return "tendance";
}

/**
 * Le libellé d'un mode dans un univers donné.
 *
 * Sert de titre de repli aux sections et aux playlists quand le modèle
 * n'écrit pas — et il doit se comprendre seul, sur une pochette.
 */
export function libelleModeUnivers(mode: Mode, univers: Univers): string {
  const label = MODES_INFO[mode].label;
  return univers === "christian" ? `${label} gospel` : label;
}

/* ---------------------------------------------------------- affinité -- */

/** Ce qu'il faut savoir d'un titre pour le rapprocher d'un mode d'ambiance. */
export type ProfilTitre = {
  bpm?: number;
  genre?: string;
  tags?: string[];
  titre?: string;
  /** En secondes. */
  duree?: number;
  explicite?: boolean;
};

/**
 * Proximité d'une valeur à un intervalle, entre 0 et 1.
 *
 * 1 à l'intérieur, décroissance linéaire au-dehors, plancher à 0 au bout
 * d'une `tolerance`. Sert au tempo comme à la durée : deux grandeurs où
 * « un peu à côté » ne vaut pas « à côté ».
 */
function proximite(valeur: number, min: number, max: number, tolerance: number): number {
  if (valeur >= min && valeur <= max) return 1;
  const ecart = valeur < min ? min - valeur : valeur - max;
  return Math.max(0, 1 - ecart / tolerance);
}

/** Comparaison sans accents ni casse, sans dépendre de la recherche. */
function aplatir(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Mots-clés du mode retrouvés dans le genre, les tags ou le titre. */
export function motsClesTrouves(mode: Mode, t: ProfilTitre): string[] {
  const mots = MODES_INFO[mode].motsCles;
  if (!mots) return [];
  const texte = aplatir([t.genre ?? "", (t.tags ?? []).join(" "), t.titre ?? ""].join(" "));
  return mots.filter((m) => texte.includes(aplatir(m)));
}

/**
 * À quel point ce titre appartient à ce mode d'ambiance ?
 *
 * `null` veut dire « aucun signal » — pas « faible affinité ». C'est la
 * décision la plus importante des modes, et elle se paie : un morceau
 * sans tempo, sans mots-clés et dont le genre n'évoque rien pourrait être
 * rangé n'importe où. Douze modes tous remplis feraient meilleure
 * impression, mais une playlist « Sommeil » garnie au hasard s'entend au
 * premier titre, et on ne la relance pas.
 *
 * Les modes qui ne se définissent pas par ce que le titre EST — Matin,
 * Nuit, Découverte, Tendance — rendent `null` : ils se mesurent sur les
 * écoutes, ce que cette fonction ne voit pas (lib/curation/modes.ts).
 */
export function scoreAmbiance(mode: Mode, t: ProfilTitre): number | null {
  const info = MODES_INFO[mode];
  if (info.strategie !== "ambiance") return null;
  if (info.eviteExplicite && t.explicite) return null;

  const mots = motsClesTrouves(mode, t);
  const tempoConnu = typeof t.bpm === "number" && t.bpm > 0 && Boolean(info.bpm);
  const tempo = tempoConnu && info.bpm ? proximite(t.bpm as number, info.bpm.min, info.bpm.max, 35) : 0;

  // Le signal minimal : un tempo qui tombe vraiment dans la fourchette,
  // ou un mot-clé. Sans l'un des deux, le titre n'est pas candidat.
  if (mots.length === 0 && tempo < 0.5) return null;

  const duree =
    info.duree && t.duree && t.duree > 0 ? proximite(t.duree, info.duree.min, info.duree.max, 180) : 0.5;

  return 0.45 * (tempoConnu ? tempo : 0.4) + 0.35 * Math.min(mots.length / 2, 1) + 0.2 * duree;
}

/** Ce qui a fait entrer un titre dans un mode d'ambiance, en quelques mots. */
export function raisonAmbiance(mode: Mode, t: ProfilTitre): string {
  const mots = motsClesTrouves(mode, t);
  const info = MODES_INFO[mode];
  const raisons: string[] = [];
  if (t.bpm && info.bpm && proximite(t.bpm, info.bpm.min, info.bpm.max, 35) >= 0.5) {
    raisons.push(`${t.bpm} bpm`);
  }
  if (mots.length) raisons.push(mots.slice(0, 2).join(", "));
  return raisons.join(" · ") || "ambiance proche";
}

/* ------------------------------------------------- identifiants de recette -- */

/** Les trois sélections produites pour chaque mode. */
export const SOUS_RECETTES = {
  top: { libelle: "Les plus écoutés", intention: "les morceaux les plus écoutés qui collent à ce moment" },
  trending: { libelle: "En hausse", intention: "ceux qui montent en ce moment dans cette ambiance" },
  nouveautes: { libelle: "Nouveautés", intention: "les sorties récentes qui collent à ce moment" },
} as const;

export type SousRecette = keyof typeof SOUS_RECETTES;

export const IDS_SOUS_RECETTES = Object.keys(SOUS_RECETTES) as SousRecette[];

/**
 * Identifiant d'une sélection de mode.
 *
 * Préfixé plutôt que mélangé aux recettes globales : `Playlist.auto.kind`
 * est une chaîne libre, et ce préfixe permet de reconnaître une sélection
 * de mode sans table de correspondance — y compris dans les documents
 * écrits avant l'ajout du champ `mode`.
 */
export function idRecetteMode(mode: Mode, sous: SousRecette): string {
  return `mode:${mode}:${sous}`;
}

export function lireIdRecetteMode(id: string): { mode: Mode; sous: SousRecette } | null {
  const parts = id.split(":");
  if (parts.length !== 3 || parts[0] !== "mode") return null;
  if (!estMode(parts[1])) return null;
  const sous = parts[2] as SousRecette;
  if (!IDS_SOUS_RECETTES.includes(sous)) return null;
  return { mode: parts[1], sous };
}

/** Titre de repli d'une sélection de mode. */
export function libelleRecetteMode(mode: Mode, sous: SousRecette, univers: Univers): string {
  return `${libelleModeUnivers(mode, univers)} — ${SOUS_RECETTES[sous].libelle}`;
}

/** Identifiant de la section d'accueil d'un mode. Stable d'une semaine à l'autre. */
export function slugSectionMode(mode: Mode, univers: Univers): string {
  return univers === "christian" ? `mode-${mode}-gospel` : `mode-${mode}`;
}
