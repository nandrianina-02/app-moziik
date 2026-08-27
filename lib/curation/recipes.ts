import { estMalgache, type MesureTitre, type Signaux, type TitreCandidat } from "@/lib/curation/signals";
import { RECETTES_INFO, IDS_RECETTES, type IdRecette } from "@/lib/curation/labels";

/**
 * Les recettes : ce qui décide du contenu de chaque playlist.
 *
 * Une règle tient tout ce fichier — **les chiffres choisissent les
 * titres, jamais le modèle**. Une sélection produite par une IA serait
 * invérifiable et instable : deux exécutions sur les mêmes données ne
 * donneraient pas la même playlist, et personne ne pourrait dire pourquoi
 * un artiste y figure. Ici, chaque entrée se justifie par une mesure, et
 * `motif` dit laquelle. Le modèle n'intervient qu'ensuite, pour écrire
 * les titres et les descriptions (lib/curation/naming.ts).
 *
 * Une recette qui n'a pas de quoi remplir `min` titres ne rend rien. Une
 * playlist de trois morceaux affichée sur l'accueil dit surtout que la
 * plateforme est vide — mieux vaut que la semaine en propose six que
 * sept dont une bancale.
 */

/** En dessous, la sélection ne vaut pas d'être publiée. */
const MIN_TITRES = 5;
/** Au-dessus, personne ne descend. */
const MAX_TITRES = 25;

export type Selection = {
  /** Identifiants de titres, dans l'ordre d'écoute voulu. */
  titres: string[];
  /** Ce qui a fait cette sélection, en une phrase, pour l'administration. */
  motif: string;
  /** Titre de repli quand il dépend des données (le genre de la semaine). */
  libelle?: string;
};

export type Recette = {
  id: IdRecette;
  /** Titre de repli, employé tel quel quand l'IA n'écrit pas. */
  libelle: string;
  /** Ce que la recette sélectionne, pour la page de réglages. */
  detail: string;
  /** Consigne donnée au modèle pour qu'il nomme cette playlist. */
  intention: string;
  min: number;
  max: number;
  construire: (s: Signaux) => Selection | null;
};

/** Mesure de la semaine pour un titre, ou une mesure nulle. */
function mesure(s: Signaux, id: string): MesureTitre {
  return s.semaine.get(id) ?? { song: id, ecoutes: 0, complets: 0, auditeurs: 0, score: 0 };
}

/** Titres publiés classés par le score de la semaine, du meilleur au moins bon. */
function parScoreHebdo(s: Signaux, filtre?: (t: TitreCandidat) => boolean): TitreCandidat[] {
  const retenus: TitreCandidat[] = [];
  for (const titre of s.catalogue.values()) {
    if (filtre && !filtre(titre)) continue;
    retenus.push(titre);
  }
  return retenus.sort((a, b) => mesure(s, b.id).score - mesure(s, a.id).score);
}

/** Coupe à `max` et rend `null` en deçà de `min`. */
function borner(ids: string[], min: number, max: number): string[] | null {
  const uniques = [...new Set(ids)];
  return uniques.length >= min ? uniques.slice(0, max) : null;
}

/* ------------------------------------------------------------------ top -- */

const top: Recette = {
  id: "top",
  ...RECETTES_INFO.top,
  min: MIN_TITRES,
  max: 20,
  construire(s) {
    const classes = parScoreHebdo(s).filter((t) => mesure(s, t.id).score > 0);
    const titres = borner(classes.map((t) => t.id), this.min, this.max);
    if (!titres) return null;
    return {
      titres,
      motif: `Les ${titres.length} titres au plus fort volume d'écoutes de la fenêtre, une fois plafonnée la contribution de chaque auditeur.`,
    };
  },
};

/* ------------------------------------------------------------- trending -- */

/**
 * Lissage de la progression.
 *
 * Sans lui, un titre passé de 1 à 6 écoutes afficherait +500 % et
 * dominerait un titre passé de 400 à 900. Ajouter une constante aux deux
 * termes écrase les rapports calculés sur de très petits nombres, qui ne
 * mesurent rien d'autre que le hasard.
 */
const LISSAGE = 8;
/** En deçà, la semaine du titre est trop maigre pour qu'une hausse veuille dire quelque chose. */
const SOCLE_PROGRESSION = 10;
/** Une hausse plus faible n'est pas une tendance, c'est du bruit. */
const HAUSSE_MIN = 1.25;

const trending: Recette = {
  id: "trending",
  ...RECETTES_INFO.trending,
  min: MIN_TITRES,
  max: 15,
  construire(s) {
    const progression = (id: string) => {
      const actuel = mesure(s, id).score;
      const avant = s.precedente.get(id)?.score ?? 0;
      return (actuel + LISSAGE) / (avant + LISSAGE);
    };

    const candidats = [...s.catalogue.values()]
      .filter((t) => mesure(s, t.id).score >= SOCLE_PROGRESSION)
      .filter((t) => progression(t.id) >= HAUSSE_MIN)
      .sort((a, b) => progression(b.id) - progression(a.id));

    const titres = borner(candidats.map((t) => t.id), this.min, this.max);
    if (!titres) return null;
    return {
      titres,
      motif: `Titres en hausse d'au moins ${Math.round((HAUSSE_MIN - 1) * 100)} % sur une semaine, à partir d'un socle d'écoutes suffisant pour que la hausse ait un sens.`,
    };
  },
};

/* ----------------------------------------------------------- nouveautés -- */

const nouveautes: Recette = {
  id: "nouveautes",
  ...RECETTES_INFO.nouveautes,
  min: 4,
  max: 20,
  construire(s) {
    const dans = (t: TitreCandidat) =>
      t.sortiLe >= s.fenetre.from && t.sortiLe < s.fenetre.to;

    // Une nouveauté sans écoute reste une nouveauté : c'est la seule
    // recette où l'absence de mesure ne disqualifie pas. Le classement
    // met devant celles qui ont déjà pris, la sortie la plus récente
    // départage les autres.
    const candidats = parScoreHebdo(s, dans).sort((a, b) => {
      const ecart = mesure(s, b.id).score - mesure(s, a.id).score;
      return ecart !== 0 ? ecart : b.sortiLe.getTime() - a.sortiLe.getTime();
    });

    const titres = borner(candidats.map((t) => t.id), this.min, this.max);
    if (!titres) return null;
    return {
      titres,
      motif: `Titres publiés pendant la fenêtre, les mieux écoutés d'abord.`,
    };
  },
};

/* ----------------------------------------------------------- recherches -- */

const recherches: Recette = {
  id: "recherches",
  ...RECETTES_INFO.recherches,
  min: MIN_TITRES,
  max: 20,
  construire(s) {
    const ids: string[] = [];
    // Un terme d'abord, son meilleur titre ensuite : prendre les trois
    // titres de la première saisie remplirait la playlist avec un seul
    // artiste. On fait un tour par terme avant d'en reprendre un.
    for (let rang = 0; rang < 3; rang++) {
      for (const terme of s.recherches) {
        const id = terme.titres[rang];
        if (id && s.catalogue.has(id)) ids.push(id);
      }
    }

    const titres = borner(ids, this.min, this.max);
    if (!titres) return null;
    return {
      titres,
      motif: `Saisies les plus fréquentes de la recherche sur la fenêtre, résolues sur le catalogue d'aujourd'hui.`,
    };
  },
};

/* ------------------------------------------------------------- malgache -- */

const malgache: Recette = {
  id: "malgache",
  ...RECETTES_INFO.malgache,
  min: MIN_TITRES,
  max: 20,
  construire(s) {
    const candidats = parScoreHebdo(s, (t) => estMalgache(t.langue));

    // Une semaine creuse ne doit pas vider la playlist : à défaut
    // d'écoutes récentes, le cumul de toujours prend le relais.
    const ecouteRecente = candidats.some((t) => mesure(s, t.id).score > 0);
    const ordonnes = ecouteRecente
      ? candidats
      : [...candidats].sort((a, b) => b.ecoutesTotales - a.ecoutesTotales);

    // Mais un repli sur un cumul lui aussi nul ne classe rien : il rendrait
    // les titres dans l'ordre où la base les a lus. Une playlist nommée
    // « hits » sans la moindre écoute derrière elle est un faux
    // palmarès — exactement ce qu'une plateforme neuve publierait.
    if (!ecouteRecente && !ordonnes.some((t) => t.ecoutesTotales > 0)) return null;

    const titres = borner(ordonnes.map((t) => t.id), this.min, this.max);
    if (!titres) return null;
    return {
      titres,
      motif: `Titres dont la langue déclarée à la publication est le malgache.`,
    };
  },
};

/* ---------------------------------------------------------------- aimés -- */

/** En deçà, le taux se calcule sur trop peu d'écoutes pour signifier quoi que ce soit. */
const ECOUTES_MIN_APPRECIATION = 25;
const LIKES_MIN = 3;

const aimes: Recette = {
  id: "aimes",
  ...RECETTES_INFO.aimes,
  min: MIN_TITRES,
  max: 15,
  construire(s) {
    const taux = (t: TitreCandidat) => t.likesTotaux / Math.max(t.ecoutesTotales, 1);
    const candidats = [...s.catalogue.values()]
      .filter((t) => t.ecoutesTotales >= ECOUTES_MIN_APPRECIATION && t.likesTotaux >= LIKES_MIN)
      .sort((a, b) => taux(b) - taux(a));

    const titres = borner(candidats.map((t) => t.id), this.min, this.max);
    if (!titres) return null;
    return {
      titres,
      // Dit explicitement, parce que le nom de la playlist laisserait
      // croire à une mesure de la semaine : les « j'aime » ne sont pas
      // datés en base, aucune fenêtre n'est calculable dessus.
      motif: `Meilleur rapport « j'aime » sur écoutes, à partir de ${ECOUTES_MIN_APPRECIATION} écoutes. Compteurs cumulés depuis la publication, pas sur la semaine : les « j'aime » ne sont pas horodatés.`,
    };
  },
};

/* ---------------------------------------------------------------- genre -- */

const genre: Recette = {
  id: "genre",
  ...RECETTES_INFO.genre,
  min: MIN_TITRES,
  max: 20,
  construire(s) {
    const parGenre = new Map<string, number>();
    for (const t of s.catalogue.values()) {
      if (!t.genre) continue;
      parGenre.set(t.genre, (parGenre.get(t.genre) ?? 0) + mesure(s, t.id).score);
    }

    const [meilleur] = [...parGenre.entries()].sort((a, b) => b[1] - a[1]);
    if (!meilleur || meilleur[1] <= 0) return null;

    const nomGenre = meilleur[0];
    const candidats = parScoreHebdo(s, (t) => t.genre === nomGenre);
    const titres = borner(candidats.map((t) => t.id), this.min, this.max);
    if (!titres) return null;

    return {
      titres,
      libelle: `${nomGenre} de la semaine`,
      motif: `${nomGenre} est le genre au plus fort volume d'écoutes de la fenêtre ; voici ses titres les plus joués.`,
    };
  },
};

/**
 * Ordre de la liste = ordre proposé sur l'accueil.
 *
 * Il va du plus consensuel au plus spécifique : ce que tout le monde
 * écoute d'abord, une sélection de niche ensuite. L'admin le change à
 * la validation, mais c'est un défaut sur lequel s'appuyer.
 */
export const RECETTES: Recette[] = [top, trending, nouveautes, recherches, malgache, aimes, genre];

// Ré-exporté depuis les libellés : une seule liste d'identifiants, et
// elle reste lisible côté navigateur.
export { IDS_RECETTES };

export function recetteParId(id: string): Recette | undefined {
  return RECETTES.find((r) => r.id === id);
}

export { MIN_TITRES, MAX_TITRES };
