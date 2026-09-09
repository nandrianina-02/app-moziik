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
 *
 * POURQUOI LE STOCKAGE RESTE UNE CHAÎNE
 *
 * Un objet `{ plainText, synced, lines[] }` en base dirait la même chose,
 * mais il faudrait migrer le catalogue, réécrire le formulaire d'édition
 * et maintenir deux formes du même contenu — celle qu'on enregistre et
 * celle qu'on importe. Le LRC est déjà les deux à la fois. La forme
 * structurée existe donc bien, mais comme **vue** : `structurerParoles`
 * la produit à la demande, et c'est elle que l'API sert.
 *
 * LE MOT PAR MOT
 *
 * Le LRC « enrichi » horodate chaque mot entre chevrons :
 *
 *   [00:12.40]<00:12.40>Je <00:12.70>marche <00:13.20>dans
 *
 * Ces marques étaient jusqu'ici retirées et perdues. Elles sont
 * maintenant décodées en `mots`, que l'affichage utilise s'il sait quoi
 * en faire et ignore sinon — la ligne garde son texte complet dans tous
 * les cas.
 */

export type MotParoles = {
  /** Secondes depuis le début du morceau. */
  debut: number;
  /** Début du mot suivant, absent sur le dernier mot de la ligne. */
  fin?: number;
  texte: string;
};

export type LigneParoles = {
  /** Secondes depuis le début du morceau, ou null si la ligne n'est pas horodatée. */
  temps: number | null;
  /** Début de la ligne suivante. Absent sur la dernière : on ignore où finit le morceau. */
  fin?: number;
  texte: string;
  /** Horodatage mot à mot, quand la source en porte. */
  mots?: MotParoles[];
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
/** LRC « enrichi » : horodatage par mot, `<00:12.34>`. */
const HORODATAGE_MOT = /<(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)>/g;

const PAROLES_VIDES: Paroles = { synchronisees: false, lignes: [], meta: {} };

function enSecondes(minutes: string, reste: string): number {
  const [sec, frac = "0"] = reste.split(/[.:]/);
  // Un LRC écrit les centièmes sur 2 chiffres, parfois les millièmes sur 3.
  const diviseur = Math.pow(10, frac.length);
  return Number(minutes) * 60 + Number(sec) + Number(frac) / diviseur;
}

/**
 * Découpe une ligne enrichie en mots horodatés.
 *
 * Rend aussi le texte débarrassé des marques, qui reste la seule chose
 * affichée quand on ne fait rien du mot à mot. Les espaces d'origine y
 * sont conservés : c'est ce texte-là que lisent la traduction, la copie
 * et la page du titre.
 */
function decouperEnMots(reste: string): MotParoles[] | undefined {
  HORODATAGE_MOT.lastIndex = 0;
  const marques: { index: number; longueur: number; debut: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = HORODATAGE_MOT.exec(reste)) !== null) {
    marques.push({ index: m.index, longueur: m[0].length, debut: enSecondes(m[1], m[2]) });
  }
  if (marques.length === 0) return undefined;

  const mots: MotParoles[] = [];
  for (let i = 0; i < marques.length; i++) {
    const depart = marques[i].index + marques[i].longueur;
    const arrivee = i + 1 < marques.length ? marques[i + 1].index : reste.length;
    const texte = reste.slice(depart, arrivee).trim();
    // Une marque suivie de rien (fin de ligne, ou deux marques collées)
    // ne désigne aucun mot : la garder afficherait un blanc surligné.
    if (texte) mots.push({ debut: marques[i].debut, texte });
  }
  if (mots.length === 0) return undefined;

  for (let i = 0; i < mots.length - 1; i++) mots[i].fin = mots[i + 1].debut;
  return mots;
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

    const sansHorodatageDeLigne = ligne.replace(HORODATAGE, "");
    const mots = decouperEnMots(sansHorodatageDeLigne);
    const texte = sansHorodatageDeLigne.replace(HORODATAGE_MOT, "").trim();

    if (temps.length === 0) {
      // Une ligne enrichie peut n'avoir que des marques de mots : le
      // premier mot donne alors le départ de la ligne.
      if (mots) {
        horodatees += 1;
        lignes.push({ temps: mots[0].debut, texte, mots });
        continue;
      }
      lignes.push({ temps: null, texte: ligne });
      continue;
    }
    horodatees += temps.length;
    // Un même texte peut porter plusieurs horodatages (refrain) : chacun
    // devient une ligne à part entière, sinon le refrain ne s'allume
    // qu'à sa première occurrence.
    //
    // Le mot à mot n'accompagne que la première : les marques de mots
    // sont des instants absolus, pas des durées. Les recopier sur la
    // reprise ferait surligner des mots trois minutes trop tôt.
    for (let i = 0; i < temps.length; i++) {
      lignes.push({ temps: temps[i], texte, ...(i === 0 && mots ? { mots } : {}) });
    }
  }

  // Décalage global éventuel, en millisecondes (balise LRC `offset`).
  const decalage = Number(meta.offset);
  if (Number.isFinite(decalage) && decalage !== 0) {
    const secondes = decalage / 1000;
    for (const l of lignes) {
      if (l.temps !== null) l.temps = Math.max(0, l.temps - secondes);
      if (l.mots) {
        for (const mot of l.mots) {
          mot.debut = Math.max(0, mot.debut - secondes);
          if (mot.fin !== undefined) mot.fin = Math.max(0, mot.fin - secondes);
        }
      }
    }
  }

  const synchronisees = horodatees >= 2;
  if (synchronisees) {
    lignes.sort((a, b) => {
      if (a.temps === null) return 1;
      if (b.temps === null) return -1;
      return a.temps - b.temps;
    });
    poserLesFins(lignes);
  }

  return {
    synchronisees,
    lignes,
    credits: meta.by || undefined,
    meta,
  };
}

/**
 * Renseigne `fin` à partir du départ de la ligne horodatée suivante.
 *
 * Les lignes vides intercalées sont sautées : la fin d'un couplet est le
 * début du suivant, pas celui du blanc qui les sépare.
 */
function poserLesFins(lignes: LigneParoles[]): void {
  let suivante: number | undefined;
  for (let i = lignes.length - 1; i >= 0; i--) {
    const l = lignes[i];
    if (l.temps === null) continue;
    if (suivante !== undefined && suivante > l.temps) l.fin = suivante;
    // Le dernier mot d'une ligne s'arrête là où la ligne s'arrête.
    if (l.mots && l.fin !== undefined) {
      const dernier = l.mots[l.mots.length - 1];
      if (dernier.fin === undefined) dernier.fin = l.fin;
    }
    suivante = l.temps;
  }
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

/** Index du mot chanté à `seconde` dans une ligne enrichie, ou -1. */
export function motActif(mots: MotParoles[] | undefined, seconde: number): number {
  if (!mots || mots.length === 0) return -1;
  let bas = 0;
  let haut = mots.length - 1;
  let trouve = -1;
  while (bas <= haut) {
    const milieu = (bas + haut) >> 1;
    if (mots[milieu].debut > seconde) haut = milieu - 1;
    else {
      trouve = milieu;
      bas = milieu + 1;
    }
  }
  // Passé la fin du dernier mot, plus rien n'est surligné : la ligne
  // reste active mais on ne laisse pas un mot allumé jusqu'à la suivante.
  if (trouve >= 0) {
    const fin = mots[trouve].fin;
    if (fin !== undefined && seconde >= fin) return -1;
  }
  return trouve;
}

/** Texte nu, sans horodatage — ce qu'on envoie à traduire ou qu'on copie. */
export function parolesEnTexte(paroles: Paroles): string {
  return paroles.lignes.map((l) => l.texte).join("\n");
}

/* ------------------------------------------------- forme structurée -- */

/**
 * Une ligne telle que l'API la sert et qu'un éditeur la consomme.
 *
 * Clés en anglais, comme le reste des charges JSON du projet
 * (`coverUrl`, `startedAt`…). Les types internes, eux, restent en
 * français : ce sont deux publics différents.
 */
export type LigneSynchronisee = {
  text: string;
  startTime: number;
  endTime?: number;
  words?: { text: string; startTime: number; endTime?: number }[];
};

export type ParolesStructurees = {
  /** Le texte seul, sans horodatage : ce qu'on affiche à défaut de mieux. */
  plainText: string;
  /** Vrai dès que deux lignes au moins portent un horodatage exploitable. */
  synced: boolean;
  /** Uniquement les lignes horodatées, dans l'ordre. Vide si non synchronisé. */
  lines: LigneSynchronisee[];
  /** Qui a transcrit ou synchronisé, si la source le dit (`[by:…]`). */
  credits?: string;
};

function versLigneSynchronisee(l: LigneParoles): LigneSynchronisee {
  return {
    text: l.texte,
    startTime: l.temps as number,
    ...(l.fin !== undefined ? { endTime: l.fin } : {}),
    ...(l.mots
      ? {
          words: l.mots.map((mot) => ({
            text: mot.texte,
            startTime: mot.debut,
            ...(mot.fin !== undefined ? { endTime: mot.fin } : {}),
          })),
        }
      : {}),
  };
}

/**
 * Le LRC brut, rendu sous la forme que consomment l'API et l'éditeur.
 *
 * Non synchronisé, `lines` est vide et `plainText` porte tout : c'est ce
 * qui distingue « pas d'horodatage » de « pas de paroles », deux états
 * que l'interface ne doit pas confondre.
 */
export function structurerParoles(brut?: string | null): ParolesStructurees {
  const paroles = analyserParoles(brut);
  return {
    plainText: parolesEnTexte(paroles).trim(),
    synced: paroles.synchronisees,
    lines: paroles.synchronisees
      ? paroles.lignes.filter((l) => l.temps !== null).map(versLigneSynchronisee)
      : [],
    ...(paroles.credits ? { credits: paroles.credits } : {}),
  };
}

/**
 * Décode un fichier LRC en lignes horodatées.
 *
 * Ne rend que ce qui porte un horodatage : c'est le contrat attendu d'un
 * import LRC, et une ligne sans temps n'a rien à faire dans une liste
 * qu'on va classer par temps. Le texte non horodaté d'un fichier
 * partiellement synchronisé n'est pas perdu pour autant — il reste dans
 * `structurerParoles().plainText`.
 */
export function parseLRC(lrcText: string): LigneSynchronisee[] {
  const paroles = analyserParoles(lrcText);
  return paroles.lignes.filter((l) => l.temps !== null).map(versLigneSynchronisee);
}

/* ----------------------------------------------------- sérialisation -- */

/** `93.4` → `"01:33.40"`. Deux décimales : la précision du format LRC. */
export function formaterTemps(secondes: number): string {
  const sur = Math.max(0, secondes);
  const min = Math.floor(sur / 60);
  const sec = Math.floor(sur % 60);
  const cent = Math.round((sur - Math.floor(sur)) * 100);
  // L'arrondi des centièmes peut atteindre 100 : sans ce report, on
  // écrirait « 01:33.100 », qu'aucun lecteur ne saurait relire.
  if (cent === 100) return formaterTemps(Math.floor(sur) + 1);
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(cent).padStart(2, "0")}`;
}

/** `"01:33.40"`, `"1:33"`, `"93.4"` → secondes, ou null si illisible. */
export function lireTemps(saisie: string): number | null {
  const propre = saisie.trim();
  if (!propre) return null;
  const avecMinutes = propre.match(/^(\d{1,3}):(\d{1,2})(?:[.,:](\d{1,3}))?$/);
  if (avecMinutes) {
    const frac = avecMinutes[3] ?? "0";
    return (
      Number(avecMinutes[1]) * 60 +
      Number(avecMinutes[2]) +
      Number(frac) / Math.pow(10, frac.length)
    );
  }
  const secondes = Number(propre.replace(",", "."));
  return Number.isFinite(secondes) && secondes >= 0 ? secondes : null;
}

export type LigneEditable = { temps: number | null; texte: string };

/**
 * Réécrit des lignes en LRC, prêtes à être enregistrées dans `Song.lyrics`.
 *
 * Les lignes sans horodatage sont écrites telles quelles : un morceau à
 * moitié synchronisé doit pouvoir être enregistré et repris plus tard,
 * sinon l'éditeur oblige à tout finir d'un coup.
 */
export function versLRC(lignes: LigneEditable[], meta?: Record<string, string>): string {
  const entetes = Object.entries(meta ?? {})
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `[${k}:${String(v).trim()}]`);

  const corps = lignes.map((l) =>
    l.temps === null ? l.texte : `[${formaterTemps(l.temps)}]${l.texte}`
  );

  return [...entetes, ...corps].join("\n");
}
