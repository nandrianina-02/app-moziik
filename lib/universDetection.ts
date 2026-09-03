import { normaliser } from "@/lib/searchText";
import type { Univers } from "@/lib/univers";

/**
 * Reconnaître un titre ou un artiste du répertoire évangélique, sans
 * appeler personne.
 *
 * POURQUOI UN LEXIQUE AVANT UN MODÈLE
 *
 * Classer un catalogue de plusieurs milliers de titres par appels d'IA
 * coûterait cher, prendrait des heures, et — surtout — donnerait un
 * résultat qu'on ne pourrait pas expliquer titre par titre. Or c'est un
 * classement qui décide de ce qu'un auditeur entend : il doit pouvoir se
 * relire. Ici, chaque verdict s'accompagne des mots qui l'ont produit.
 *
 * Le modèle n'est pas écarté pour autant : il traite la bande
 * d'incertitude, celle où le lexique voit un indice sans pouvoir
 * trancher (lib/ai/universLabel.ts). C'est une poignée de titres, pas le
 * catalogue entier.
 *
 * DEUX POIDS, PARCE QUE LES MOTS NE SE VALENT PAS
 *
 * « Jesosy » ne laisse aucun doute. « Dieu », « foi », « ange », « ciel »
 * traversent toute la chanson d'amour depuis qu'elle existe : les
 * compter à égalité rangerait la moitié de la variété française dans le
 * gospel. Les seconds ne pèsent donc que par accumulation, ou en renfort
 * d'un premier.
 *
 * LA LANGUE COMPTE ICI PLUS QU'AILLEURS
 *
 * Le catalogue est très majoritairement malgache et francophone. Un
 * lexique purement anglais — celui qu'on trouve tout fait — passerait à
 * côté de l'essentiel du répertoire de louange malgache, qui est la plus
 * grosse part du gospel local.
 */

/** Mots qui suffisent seuls : ils n'ont pas d'usage profane courant. */
const FORTS = [
  // Français
  "gospel", "louange", "adoration", "adorateur", "evangelique", "evangile",
  "chretien", "chretienne", "cantique", "psaume", "alleluia", "hosanna",
  "sainte cene", "saint esprit", "esprit saint", "jesus", "christ",
  "emmanuel", "messie", "sauveur", "redempteur", "calvaire", "seigneur",
  "resurrection", "parole de dieu", "gloire a dieu",
  "sang de jesus", "agneau de dieu", "royaume de dieu",
  // Malgache
  "jesosy", "jesoa", "jeso", "kristy", "andriamanitra", "fiderana", "fihirana",
  "fanahy masina", "mpamonjy", "mpanavotra", "baiboly", "fiangonana",
  "fivavahana", "fahasoavana", "voninahitra",
  "zanahary", "hira fiderana", "hira fanevana", "mpitandrina",
  // Le nom de Dieu et les acclamations, dans leur graphie malgache :
  // « Haleloia », « Hosana », « Jehovah » ne s'écrivent pas comme leurs
  // équivalents français, et c'est sous cette forme qu'ils titrent le
  // répertoire de louange local.
  "jehovah", "jeova", "haleloia", "hosana",
  "fihiram-baovao", "fihiram baovao",
  "fananganana ny maty", "fitsanganana amin'ny maty",
  "evanjely", "apostoly", "pastera", "fifohazana", "mpiandry",
  "sekoly alahady", "antsam-piderana",
  // Les Églises malgaches : leur sigle est un marqueur sans équivoque,
  // et il titre quantité de chants de fête paroissiale.
  "fjkm", "flm", "ekar", "fpvm", "adventista",
  // Anglais
  "worship", "praise", "hallelujah", "holy spirit",
  "christian", "redeemer", "salvation", "born again", "amazing grace",
];

/**
 * Mots qui ne comptent qu'ensemble, ou en renfort d'un mot fort.
 * Chacun d'eux est courant hors du répertoire évangélique.
 */
const FAIBLES = [
  "dieu", "priere", "eglise", "foi", "grace",
  "benediction", "gloire", "ciel", "ange", "amen",
  "temoignage", "miracle", "esperance", "eternel",
  "croix", "bible", "berger", "sainte",
  "tompo", "lanitra", "anjely", "finoana", "fanantenana", "famonjena",
  "fiadanana", "masina", "vavaka",
  "lord", "god", "faith", "prayer", "church", "blessing",
  "glory", "heaven", "angel", "testimony", "savior", "saviour", "hymn",
];

/** Genres qui définissent l'univers à eux seuls, quel que soit le reste. */
const GENRES_CHRETIENS = [
  "gospel", "louange", "adoration", "worship", "praise", "chretien",
  "chretienne", "christian", "cantique", "fiderana", "ccm",
];

/** Mots-clés de tempo lent employés par la recette « Adoration ». */
const MOTS_ADORATION = ["adoration", "worship", "adorateur", "fiderana", "contemplation", "meditation"];

export type IndiceUnivers = { mot: string; poids: "fort" | "faible"; champ: string };

export type Verdict = {
  univers: Univers;
  /** 0 à 1. Au-delà de `SEUIL_CERTAIN`, aucune relecture n'est nécessaire. */
  confiance: number;
  /** Ce qui a produit le verdict, mot par mot. Affiché en administration. */
  indices: IndiceUnivers[];
  /** Vrai quand le lexique voit quelque chose sans pouvoir trancher. */
  incertain: boolean;
};

/**
 * Le seuil qui décide. Au-dessus, le contenu est évangélique.
 *
 * Il est volontairement haut, et le déséquilibre est assumé : ranger un
 * morceau de variété dans la louange se remarque immédiatement chez
 * l'auditeur qui a choisi le répertoire évangélique, tandis que l'oubli
 * inverse passe inaperçu et se rattrape à la passe suivante.
 */
export const SEUIL_CERTAIN = 0.75;
/** En deçà, un mot fort isolé ne dit rien : il n'y a même pas matière à arbitrage. */
export const SEUIL_INDICE = 0.2;

/**
 * Diviseur de normalisation du score.
 *
 * Calé sur un mot fort dans le titre — 2 × 1,4 = 2,8 — qui doit suffire à
 * lui seul : « Jesosy no Tompo » ou « Andriamanitra tsara » ne demandent
 * l'avis de personne. Un mot fort dans un champ secondaire (description,
 * biographie) reste en dessous, et c'est voulu.
 */
const DIVISEUR = 3;

export type ChampsAnalyses = {
  titre?: string;
  artiste?: string;
  genre?: string;
  tags?: string[];
  paroles?: string;
  description?: string;
  bio?: string;
  album?: string;
};

/**
 * Cherche un mot du lexique dans un texte normalisé.
 *
 * La borne gauche est vérifiée à la main plutôt qu'avec un `\b` : les
 * entrées du lexique contiennent des espaces (« saint esprit », « hira
 * fiderana »), et un suffixe doit rester toléré pour accrocher les
 * déclinaisons malgaches et les pluriels. Une simple inclusion, elle,
 * rangerait « saint » dans « maintenant ».
 */
function contient(texte: string, mot: string): boolean {
  let depuis = 0;
  for (;;) {
    const i = texte.indexOf(mot, depuis);
    if (i === -1) return false;
    const avant = i === 0 ? " " : texte[i - 1];
    if (!/[a-z0-9]/.test(avant) && finBienPosee(texte, i + mot.length, mot)) return true;
    depuis = i + mot.length;
  }
}

/**
 * Longueur en deçà de laquelle un mot doit finir où il finit.
 *
 * La tolérance de suffixe est indispensable au malgache, dont les
 * déclinaisons s'accrochent au radical. Mais appliquée à un mot de trois
 * ou quatre lettres, elle range « foire » dans la foi et « godasse »
 * dans God — et elle empêche d'employer les sigles des Églises, FJKM ou
 * FLM, qui sont pourtant les marqueurs les plus nets du répertoire.
 */
const COURT = 4;

/** Seuls le pluriel et rien d'autre sont tolérés après un mot court. */
function finBienPosee(texte: string, fin: number, mot: string): boolean {
  if (mot.length > COURT) return true;
  const apres = texte[fin];
  if (apres === undefined || !/[a-z0-9]/.test(apres)) return true;
  return (apres === "s" || apres === "x") && !/[a-z0-9]/.test(texte[fin + 1] ?? " ");
}

/** Poids d'un champ : le titre dit bien plus que la description. */
const POIDS_CHAMP: Record<string, number> = {
  titre: 1.4,
  artiste: 1.2,
  tags: 1.1,
  album: 1,
  paroles: 1,
  description: 0.7,
  bio: 0.9,
};

/**
 * Classe un contenu à partir de ce que la base sait déjà de lui.
 *
 * Rien n'est inventé : les paroles, quand elles sont là, sont la matière
 * la plus fiable ; à défaut, le titre et le genre suffisent le plus
 * souvent, parce que le répertoire de louange se nomme.
 */
export function detecterUnivers(champs: ChampsAnalyses): Verdict {
  const indices: IndiceUnivers[] = [];
  let score = 0;

  const genre = normaliser(champs.genre ?? "");
  if (genre && GENRES_CHRETIENS.some((g) => contient(genre, g))) {
    indices.push({ mot: champs.genre ?? genre, poids: "fort", champ: "genre" });
    // Le genre déclaré à la publication est une déclaration de l'artiste
    // lui-même : rien dans les paroles ne la contredira utilement.
    return { univers: "christian", confiance: 1, indices, incertain: false };
  }

  const textes: [string, string][] = [
    ["titre", champs.titre ?? ""],
    ["artiste", champs.artiste ?? ""],
    ["album", champs.album ?? ""],
    ["tags", (champs.tags ?? []).join(" ")],
    // Les paroles portent le signal le plus net, mais aussi le plus de
    // bruit : on n'en lit qu'un début, assez pour un refrain.
    ["paroles", (champs.paroles ?? "").slice(0, 4000)],
    ["description", (champs.description ?? "").slice(0, 2000)],
    ["bio", (champs.bio ?? "").slice(0, 2000)],
  ];

  for (const [champ, brut] of textes) {
    if (!brut) continue;
    const texte = normaliser(brut);
    const poidsChamp = POIDS_CHAMP[champ] ?? 1;

    for (const mot of FORTS) {
      if (!contient(texte, mot)) continue;
      indices.push({ mot, poids: "fort", champ });
      score += 2 * poidsChamp;
      // Un seul mot fort par champ : un refrain qui répète « Jesosy »
      // vingt fois ne vaut pas vingt preuves.
      break;
    }

    let faiblesDuChamp = 0;
    for (const mot of FAIBLES) {
      if (!contient(texte, mot)) continue;
      indices.push({ mot, poids: "faible", champ });
      faiblesDuChamp += 1;
      if (faiblesDuChamp >= 3) break;
    }
    score += faiblesDuChamp * 0.6 * poidsChamp;
  }

  const confiance = Math.min(score / DIVISEUR, 1);
  const aDesIndicesForts = indices.some((i) => i.poids === "fort");
  const faibles = indices.filter((i) => i.poids === "faible").length;

  // Un seul seuil décide, et il est haut. Les mots faibles ne peuvent
  // jamais l'atteindre seuls : « mon ange », « le ciel », « Dieu merci »
  // et « une histoire de foi » restent de la variété, ce qu'ils sont. Il
  // faut un mot fort, et dans un champ qui compte.
  const christian = confiance >= SEUIL_CERTAIN;

  return {
    univers: christian ? "christian" : "general",
    confiance,
    indices,
    // La bande d'incertitude, celle que le modèle arbitre : un mot fort
    // trouvé dans un champ secondaire, ou une accumulation de mots
    // faibles trop dense pour être fortuite. En dessous, il n'y a rien à
    // arbitrer — et un appel de modèle par chanson d'amour serait une
    // dépense pure.
    incertain: !christian && (aDesIndicesForts ? confiance >= SEUIL_INDICE : faibles >= 4),
  };
}

/** Vrai si le titre relève de l'adoration : tempo lent, ou mot-clé explicite. */
export function estAdoration({
  bpm,
  genre,
  tags,
  titre,
}: {
  bpm?: number;
  genre?: string;
  tags?: string[];
  titre?: string;
}): boolean {
  const texte = normaliser([genre ?? "", (tags ?? []).join(" "), titre ?? ""].join(" "));
  if (MOTS_ADORATION.some((m) => contient(texte, m))) return true;
  // 85 bpm : au-dessus, on entend une louange rythmée, pas une adoration.
  return typeof bpm === "number" && bpm > 0 && bpm <= 85;
}

/** Une phrase résumant le verdict, pour l'écran d'administration. */
export function resumerVerdict(verdict: Verdict): string {
  if (verdict.indices.length === 0) return "Aucun indice évangélique dans les données disponibles.";
  const mots = [...new Set(verdict.indices.map((i) => i.mot))].slice(0, 5).join(", ");
  const champs = [...new Set(verdict.indices.map((i) => i.champ))].join(", ");
  return `Relevé dans ${champs} : ${mots}.`;
}
