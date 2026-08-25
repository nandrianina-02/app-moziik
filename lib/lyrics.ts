/**
 * Lecture des paroles, synchronisées ou non.
 *
 * Le modèle Song stocke les paroles dans un simple champ texte. Plutôt
 * que d'ajouter un champ dédié (et d'obliger les artistes à ressaisir ce
 * qu'ils ont déjà), on reconnaît le format LRC directement dans ce champ :
 * c'est le format d'échange standard des paroles synchronisées, celui que
 * produisent tous les éditeurs, et il reste parfaitement lisible tel quel
 * si rien ne le décode.
 *
 *   [ar:Nandrianina]
 *   [by:Transcription — Hery R.]
 *   [00:12.34]Première ligne
 *   [00:15.60][01:42.10]Refrain répété deux fois
 *
 * Un texte sans horodatage reste affiché normalement, simplement sans
 * défilement automatique : `synchronisees` vaut alors false.
 */

export type LigneParoles = {
  /** Secondes depuis le début du morceau, ou null si la ligne n'est pas horodatée. */
  temps: number | null;
  texte: string;
};

export type Paroles = {
  synchronisees: boolean;
  lignes: LigneParoles[];
  /** Contenu de la balise LRC `[by:…]` — qui a transcrit ou synchronisé les paroles. */
  credits?: string;
  /** Balises LRC d'en-tête reconnues (ti, ar, al, by, offset…). */
  meta: Record<string, string>;
};

const HORODATAGE = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;
const BALISE_META = /^\[([a-z]{2,8}):(.*)\]$/i;
/** LRC « enrichi » : horodatage par mot, `<00:12.34>`. On l'ignore, on ne l'affiche pas. */
const HORODATAGE_MOT = /<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g;

const PAROLES_VIDES: Paroles = { synchronisees: false, lignes: [], meta: {} };

function enSecondes(minutes: string, reste: string): number {
  const [sec, frac = "0"] = reste.split(/[.:]/);
  // Un LRC écrit les centièmes sur 2 chiffres, parfois les millièmes sur 3.
  const diviseur = Math.pow(10, frac.length);
  return Number(minutes) * 60 + Number(sec) + Number(frac) / diviseur;
}

export function analyserParoles(brut?: string | null): Paroles {
  if (!brut || !brut.trim()) return PAROLES_VIDES;

  const meta: Record<string, string> = {};
  const lignes: LigneParoles[] = [];
  let horodatees = 0;

  for (const ligneBrute of brut.split(/\r?\n/)) {
    const ligne = ligneBrute.trim();
    if (!ligne) {
      // Une ligne vide sépare les couplets : on la garde, elle fait partie
      // de la mise en page voulue par l'auteur.
      lignes.push({ temps: null, texte: "" });
      continue;
    }

    // Balise d'en-tête : `[ti:...]`. Se distingue d'un horodatage par le
    // fait que la clé n'est pas numérique.
    const entete = ligne.match(BALISE_META);
    if (entete && !/^\d+$/.test(entete[1])) {
      meta[entete[1].toLowerCase()] = entete[2].trim();
      continue;
    }

    HORODATAGE.lastIndex = 0;
    const temps: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = HORODATAGE.exec(ligne)) !== null) temps.push(enSecondes(m[1], m[2]));

    const texte = ligne.replace(HORODATAGE, "").replace(HORODATAGE_MOT, "").trim();

    if (temps.length === 0) {
      lignes.push({ temps: null, texte: ligne });
      continue;
    }
    horodatees += temps.length;
    // Un même texte peut porter plusieurs horodatages (refrain) : chacun
    // devient une ligne à part entière, sinon le refrain ne s'allume
    // qu'à sa première occurrence.
    for (const t of temps) lignes.push({ temps: t, texte });
  }

  // Décalage global éventuel, en millisecondes (balise LRC `offset`).
  const decalage = Number(meta.offset);
  if (Number.isFinite(decalage) && decalage !== 0) {
    for (const l of lignes) {
      if (l.temps !== null) l.temps = Math.max(0, l.temps - decalage / 1000);
    }
  }

  const synchronisees = horodatees >= 2;
  if (synchronisees) {
    lignes.sort((a, b) => {
      if (a.temps === null) return 1;
      if (b.temps === null) return -1;
      return a.temps - b.temps;
    });
  }

  return {
    synchronisees,
    lignes,
    credits: meta.by || undefined,
    meta,
  };
}

/**
 * Index de la ligne chantée à `seconde`, ou -1 avant la première.
 *
 * Recherche dichotomique : ce calcul tourne à chaque `timeupdate`, soit
 * environ quatre fois par seconde, sur des morceaux qui peuvent compter
 * plusieurs centaines de lignes.
 */
export function ligneActive(lignes: LigneParoles[], seconde: number): number {
  let bas = 0;
  let haut = lignes.length - 1;
  let trouve = -1;
  while (bas <= haut) {
    const milieu = (bas + haut) >> 1;
    const t = lignes[milieu].temps;
    if (t === null || t > seconde) {
      haut = milieu - 1;
    } else {
      trouve = milieu;
      bas = milieu + 1;
    }
  }
  return trouve;
}

/** Texte nu, sans horodatage — ce qu'on envoie à traduire ou qu'on copie. */
export function parolesEnTexte(paroles: Paroles): string {
  return paroles.lignes.map((l) => l.texte).join("\n");
}
