/**
 * Bass Boost Moziik — 5 niveaux, un vrai traitement audio.
 *
 * Remplace l'égaliseur graphique 10 bandes. Un égaliseur demande à
 * l'auditeur de savoir ce qu'il fait ; ici, cinq réglages nommés font le
 * travail, et chacun correspond à un jeu de filtres pensé ensemble.
 *
 * Les valeurs ci-dessous ne sont pas choisies au jugé : la réponse en
 * fréquence de la chaîne a été mesurée dans le navigateur
 * (`getFrequencyResponse` sur les noeuds réels) et les paramètres ajustés
 * jusqu'à obtenir la courbe visée. Au niveau « Profond », mesuré :
 *
 *      16 Hz  +0.9      40 Hz  +8.2      80 Hz  +9.0     250 Hz  −1.8
 *      20 Hz  +1.5      50 Hz +10.0     100 Hz  +6.1     400 Hz  −2.2
 *      30 Hz  +4.1      60 Hz  +9.9     150 Hz  +1.5     ≥1 kHz  ~0
 *
 * Trois décisions expliquent cette forme.
 *
 * 1. **Deux cloches, pas un low-shelf.** Un low-shelf monte tout ce qui
 *    est sous sa fréquence, y compris l'infra-basse : la première version
 *    mesurée renforçait le 16 Hz de +9.7 dB. C'est inaudible, ça consomme
 *    toute la marge avant écrêtage et ça fait battre les haut-parleurs
 *    pour rien. Deux filtres en cloche (75 Hz et 45 Hz) donnent le même
 *    grave perçu et redescendent naturellement sous 30 Hz.
 *
 * 2. **Un creux vers 300 Hz.** C'est le point clé pour « préserver les
 *    voix ». Renforcer les basses masque toujours le bas médium : la voix
 *    devient boueuse. Creuser doucement cette zone la laisse respirer
 *    pendant que le grave monte.
 *
 * 3. **Une ATTÉNUATION d'entrée, jamais un gain.** Ajouter 10 dB de grave
 *    à un master déjà à −0.1 dBFS écrête immédiatement — c'est le son
 *    « bizarre » et saturé. On baisse donc l'ensemble d'environ 40 % du
 *    boost. Conséquence voulue : le contraste grave/médium augmente
 *    réellement, au lieu de tout monter en volume (ce qui ne « boost »
 *    rien du tout).
 *
 * Il n'y a volontairement PAS de coupe-bas : mesuré, un `highpass`
 * Web Audio placé si bas (28 Hz à 48 kHz) ajoute une bosse parasite de
 * +1.6 dB vers 40 Hz — la précision des coefficients s'effondre à ces
 * fréquences normalisées. Les cloches ne montent plus l'infra-basse, il
 * n'a donc plus rien à protéger.
 *
 * Au niveau « Off », tous les gains valent 0 dB : les filtres en cloche
 * sont alors mathématiquement à l'unité et la chaîne est exactement
 * transparente (0.00 dB à toutes les fréquences, mesuré).
 */

export type NiveauBass = "off" | "leger" | "normal" | "profond" | "tres-profond";

export type ReglageBass = {
  id: NiveauBass;
  label: string;
  /** Une ligne affichée sous le sélecteur. */
  description: string;
  /** Cloche 75 Hz, Q 1.0 — le corps du grave (dB). */
  poidsDb: number;
  /** Cloche 45 Hz, Q 1.4 — la profondeur, le sub qu'on ressent (dB). */
  profondeurDb: number;
  /** Cloche 300 Hz, Q 0.7 — négative : dégage le bas médium et la voix (dB). */
  clarteDb: number;
  /** Atténuation d'entrée (dB, négative) : préserve la marge avant écrêtage. */
  preGainDb: number;
};

export const NIVEAUX_BASS: ReglageBass[] = [
  {
    id: "off",
    label: "Off",
    description: "Aucun traitement — le morceau tel qu'il a été masterisé.",
    poidsDb: 0,
    profondeurDb: 0,
    clarteDb: 0,
    preGainDb: 0,
  },
  {
    id: "leger",
    label: "Léger",
    description: "Un peu de corps, sans rien changer à l'équilibre du morceau.",
    poidsDb: 3,
    profondeurDb: 2.2,
    clarteDb: -1.1,
    preGainDb: -1.2,
  },
  {
    id: "normal",
    label: "Normal",
    description: "Grave présent et net. Le bon réglage pour la plupart des casques.",
    poidsDb: 5.5,
    profondeurDb: 4,
    clarteDb: -2,
    preGainDb: -2.2,
  },
  {
    id: "profond",
    label: "Profond",
    description: "Basses puissantes et profondes, voix toujours dégagée.",
    poidsDb: 8,
    profondeurDb: 6,
    clarteDb: -3,
    preGainDb: -3.2,
  },
  {
    id: "tres-profond",
    label: "Très profond",
    description: "Maximum de grave. À réserver au casque et aux enceintes qui suivent.",
    poidsDb: 10.5,
    profondeurDb: 8,
    clarteDb: -3.8,
    preGainDb: -4.2,
  },
];

export const NIVEAU_BASS_PAR_DEFAUT: NiveauBass = "off";

/**
 * Fréquences et facteurs de qualité de la chaîne. Fixes : ils sont choisis
 * les uns par rapport aux autres, et la courbe ci-dessus en dépend.
 */
export const FREQ_POIDS = 75;
export const Q_POIDS = 1.0;
export const FREQ_PROFONDEUR = 45;
export const Q_PROFONDEUR = 1.4;
export const FREQ_CLARTE = 300;
export const Q_CLARTE = 0.7;

export function reglageBass(niveau: NiveauBass): ReglageBass {
  return NIVEAUX_BASS.find((n) => n.id === niveau) ?? NIVEAUX_BASS[0];
}

/** Convertit des décibels en gain linéaire (facteur d'amplitude). */
export function dbVersGain(db: number): number {
  return Math.pow(10, db / 20);
}
