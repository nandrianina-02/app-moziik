import {
  MODES,
  MODES_INFO,
  SOUS_RECETTES,
  idRecetteMode,
  libelleRecetteMode,
  raisonAmbiance,
  scoreAmbiance,
  type Mode,
  type SousRecette,
} from "@/lib/modes";
import type { Signaux, TitreCandidat, MesureTitre } from "@/lib/curation/signals";
import type { Univers } from "@/lib/univers";

/**
 * Ce qui remplit un mode d'écoute.
 *
 * UNE RÈGLE, LA MÊME QUE POUR LE RESTE DE LA CURATION
 *
 * Les chiffres choisissent les titres, jamais le modèle. Chaque morceau
 * retenu l'est pour une raison qu'on peut lire : son tempo tombe dans la
 * fourchette du mode, son genre porte un mot-clé du mode, ou le public
 * l'écoute effectivement à l'heure du mode. Le modèle n'intervient
 * qu'après, pour écrire le nom de la playlist.
 *
 * UN TITRE SANS AUCUN SIGNAL N'ENTRE PAS
 *
 * C'est la décision la plus importante de ce fichier, et elle se paie.
 * Un morceau sans `bpm`, sans `tags` et dont le genre n'évoque rien
 * pourrait être rangé n'importe où — et douze modes tous remplis
 * feraient meilleure impression qu'un seul. Mais une playlist « Sommeil »
 * garnie au hasard s'entend au premier titre, et on ne la relance pas.
 * Un mode qui n'a pas de quoi remplir cinq titres ne rend donc rien, et
 * sa section n'apparaît pas.
 *
 * DEUX MODES NE SE MESURENT PAS COMME LES AUTRES
 *
 * « Matin » et « Nuit » ne se déduisent pas de ce qu'un titre est, mais
 * de ce que le public en fait : la part de ses écoutes tombant dans le
 * créneau. C'est le signal le plus fort dont on dispose, parce que
 * personne ne l'a saisi — il est observé.
 */

/** En dessous, la sélection ne vaut pas d'être publiée. */
const MIN_TITRES = 5;
const MAX_TITRES = 20;

/** Écoutes minimales pour qu'une part horaire veuille dire quelque chose. */
const ECOUTES_MIN_HORAIRE = 4;
/** Part du créneau au-delà de laquelle l'écoute penche vraiment. */
const PART_HORAIRE_MIN = 0.45;

/** Au-delà, un titre n'est plus une découverte. */
const ECOUTES_MAX_DECOUVERTE = 60;
/** En deçà, on ne sait pas si le titre est écouté jusqu'au bout. */
const ECOUTES_MIN_DECOUVERTE = 3;
/** Part d'écoutes menées au bout à partir de laquelle le titre « tient ». */
const COMPLETION_MIN_DECOUVERTE = 0.55;
/** Jours au-delà desquels un titre n'est plus une nouveauté à découvrir. */
const JOURS_DECOUVERTE = 180;

/** Lissage de la progression — même raison que dans recipes.ts. */
const LISSAGE = 8;
const SOCLE_PROGRESSION = 6;
const HAUSSE_MIN = 1.2;

const JOUR_MS = 24 * 60 * 60 * 1000;

export type SelectionMode = {
  mode: Mode;
  sous: SousRecette;
  /** Identifiant stocké dans `Playlist.auto.kind`. */
  id: string;
  /** Titre de repli, employé tel quel quand le modèle n'écrit pas. */
  libelle: string;
  /** Consigne donnée au modèle pour nommer cette playlist. */
  intention: string;
  /** Pourquoi ces titres, en une phrase, pour l'administration. */
  motif: string;
  titres: string[];
};

function mesure(s: Signaux, id: string): MesureTitre {
  return s.semaine.get(id) ?? { song: id, ecoutes: 0, complets: 0, auditeurs: 0, score: 0 };
}

/** Part des écoutes de la fenêtre menées jusqu'au bout. */
function completion(s: Signaux, id: string): number {
  const m = mesure(s, id);
  return m.ecoutes > 0 ? m.complets / m.ecoutes : 0;
}

function progression(s: Signaux, id: string): number {
  const actuel = mesure(s, id).score;
  const avant = s.precedente.get(id)?.score ?? 0;
  return (actuel + LISSAGE) / (avant + LISSAGE);
}

/* ------------------------------------------------------------ affinité -- */

/** Le titre, sous la forme que `scoreAmbiance` sait lire. */
function profilDe(titre: TitreCandidat) {
  return {
    bpm: titre.bpm,
    genre: titre.genre,
    tags: titre.tags,
    titre: titre.titre,
    duree: titre.duree,
    explicite: titre.explicite,
  };
}

export type Affinite = {
  /** 0 à 1. Plus c'est haut, plus le titre appartient au mode. */
  score: number;
  /** Ce qui l'a fait entrer, en quelques mots, pour l'administration. */
  raison: string;
};

/**
 * Le titre appartient-il à ce mode, et à quel point ?
 *
 * `null` veut dire « aucun signal » : le titre n'est pas candidat. C'est
 * différent d'un score faible, qui signifie « candidat, mais pas le
 * meilleur ».
 */
export function affiniteMode(mode: Mode, titre: TitreCandidat, s: Signaux): Affinite | null {
  const info = MODES_INFO[mode];

  if (info.eviteExplicite && titre.explicite) return null;

  if (info.strategie === "horaire") {
    const h = s.heures.get(titre.id);
    if (!h || h.total < ECOUTES_MIN_HORAIRE) return null;
    const part = mode === "matin" ? h.partMatin : h.partNuit;
    if (part < PART_HORAIRE_MIN) return null;

    // Le tempo ne fait qu'appuyer : c'est l'heure d'écoute qui décide.
    // Un titre sans tempo renseigné obtient la valeur neutre, jamais un
    // malus — la moitié du catalogue est dans ce cas.
    const dansLaFourchette =
      titre.bpm && info.bpm && titre.bpm >= info.bpm.min && titre.bpm <= info.bpm.max;
    return {
      score: part * 0.8 + (dansLaFourchette ? 1 : 0.5) * 0.2,
      raison: `${Math.round(part * 100)} % de ses écoutes dans le créneau`,
    };
  }

  if (info.strategie === "decouverte") {
    if (titre.ecoutesTotales > ECOUTES_MAX_DECOUVERTE) return null;
    const m = mesure(s, titre.id);
    if (m.ecoutes < ECOUTES_MIN_DECOUVERTE) return null;
    const part = completion(s, titre.id);
    if (part < COMPLETION_MIN_DECOUVERTE) return null;

    const age = (Date.now() - titre.sortiLe.getTime()) / JOUR_MS;
    if (age > JOURS_DECOUVERTE) return null;

    return {
      score: part * 0.7 + (1 - age / JOURS_DECOUVERTE) * 0.3,
      raison: `${Math.round(part * 100)} % d'écoutes menées au bout, pour ${titre.ecoutesTotales} écoutes en tout`,
    };
  }

  if (info.strategie === "tendance") {
    const m = mesure(s, titre.id);
    if (m.score < SOCLE_PROGRESSION) return null;
    const hausse = progression(s, titre.id);
    if (hausse < HAUSSE_MIN) return null;
    return {
      score: Math.min((hausse - 1) / 2, 1),
      raison: `écoutes en hausse de ${Math.round((hausse - 1) * 100)} % sur la semaine`,
    };
  }

  /* --- ambiance : ce que le titre est --------------------------------- */

  const profil = profilDe(titre);
  const score = scoreAmbiance(mode, profil);
  if (score === null) return null;

  return { score, raison: raisonAmbiance(mode, profil) };
}

/* ------------------------------------------------------------ recettes -- */

type Candidat = { titre: TitreCandidat; affinite: Affinite };

function candidatsDuMode(mode: Mode, s: Signaux): Candidat[] {
  const retenus: Candidat[] = [];
  for (const titre of s.catalogue.values()) {
    const affinite = affiniteMode(mode, titre, s);
    if (affinite) retenus.push({ titre, affinite });
  }
  return retenus;
}

function borner(ids: string[]): string[] | null {
  const uniques = [...new Set(ids)];
  return uniques.length >= MIN_TITRES ? uniques.slice(0, MAX_TITRES) : null;
}

/**
 * Les sous-sélections applicables à un mode.
 *
 * Les modes « Découverte » et « Tendance » ne produisent qu'une playlist.
 * Leur stratégie EST déjà un classement : « les nouveautés de la
 * découverte » et « ce qui monte parmi ce qui monte » désigneraient
 * presque les mêmes titres sous deux noms, ce qui donnerait à l'accueil
 * l'air d'un catalogue qui se répète.
 */
function sousRecettesDe(mode: Mode): SousRecette[] {
  const strategie = MODES_INFO[mode].strategie;
  if (strategie === "decouverte") return ["top"];
  if (strategie === "tendance") return ["top", "nouveautes"];
  return ["top", "trending", "nouveautes"];
}

function construire(mode: Mode, sous: SousRecette, s: Signaux, candidats: Candidat[]): string[] | null {
  if (sous === "top") {
    // L'affinité décide de l'appartenance, l'écoute décide de l'ordre :
    // une playlist de mode reste un classement, pas une liste de tout ce
    // qui colle à l'ambiance.
    const classes = [...candidats].sort(
      (a, b) =>
        mesure(s, b.titre.id).score * b.affinite.score - mesure(s, a.titre.id).score * a.affinite.score
    );
    // Une semaine creuse ne doit pas vider le mode : à défaut d'écoutes
    // récentes, l'affinité seule classe, départagée par le cumul.
    const ecouteRecente = classes.some((c) => mesure(s, c.titre.id).score > 0);
    const ordonnes = ecouteRecente
      ? classes
      : [...candidats].sort(
          (a, b) =>
            b.affinite.score - a.affinite.score || b.titre.ecoutesTotales - a.titre.ecoutesTotales
        );
    return borner(ordonnes.map((c) => c.titre.id));
  }

  if (sous === "trending") {
    const montants = candidats
      .filter((c) => mesure(s, c.titre.id).score >= SOCLE_PROGRESSION)
      .filter((c) => progression(s, c.titre.id) >= HAUSSE_MIN)
      .sort((a, b) => progression(s, b.titre.id) - progression(s, a.titre.id));
    return borner(montants.map((c) => c.titre.id));
  }

  // nouveautes : sorties pendant la fenêtre, les plus proches du mode
  // d'abord. Une nouveauté sans écoute reste une nouveauté.
  const recents = candidats
    .filter((c) => c.titre.sortiLe >= s.fenetre.from && c.titre.sortiLe < s.fenetre.to)
    .sort(
      (a, b) =>
        b.affinite.score - a.affinite.score || b.titre.sortiLe.getTime() - a.titre.sortiLe.getTime()
    );
  return borner(recents.map((c) => c.titre.id));
}

function motifDe(mode: Mode, sous: SousRecette, candidats: Candidat[], retenus: string[]): string {
  const info = MODES_INFO[mode];
  const exemples = retenus
    .slice(0, 2)
    .map((id) => candidats.find((c) => c.titre.id === id)?.affinite.raison)
    .filter(Boolean)
    .join(" ; ");

  const base =
    sous === "trending"
      ? `Titres du mode « ${info.label} » en hausse d'au moins ${Math.round((HAUSSE_MIN - 1) * 100)} % sur la semaine.`
      : sous === "nouveautes"
        ? `Titres du mode « ${info.label} » publiés pendant la fenêtre.`
        : `${info.detail}`;

  return exemples ? `${base} Exemples de ce qui les fait entrer : ${exemples}.` : base;
}

/**
 * Construit toutes les sélections de modes pour un univers.
 *
 * Un mode qui n'atteint pas son minimum ne rend rien, silencieusement :
 * c'est le cas normal d'un catalogue jeune, ou d'un univers évangélique
 * qui n'a pas encore assez de titres pour remplir « Sport ».
 */
export function selectionsDesModes(s: Signaux, univers: Univers, eteints: Set<string>): SelectionMode[] {
  const sorties: SelectionMode[] = [];

  for (const mode of MODES) {
    if (eteints.has(mode)) continue;

    const candidats = candidatsDuMode(mode, s);
    if (candidats.length < MIN_TITRES) continue;

    for (const sous of sousRecettesDe(mode)) {
      const id = idRecetteMode(mode, sous);
      if (eteints.has(id)) continue;

      let titres: string[] | null;
      try {
        titres = construire(mode, sous, s, candidats);
      } catch (err) {
        // Une sélection qui échoue ne doit pas emporter les trente-cinq
        // autres.
        console.error(`[curation] sélection « ${id} » en erreur, ignorée.`, err);
        continue;
      }
      if (!titres) continue;

      sorties.push({
        mode,
        sous,
        id,
        libelle: libelleRecetteMode(mode, sous, univers),
        intention: `${MODES_INFO[mode].intention} — ${SOUS_RECETTES[sous].intention}`,
        motif: motifDe(mode, sous, candidats, titres),
        titres,
      });
    }
  }

  return sorties;
}
