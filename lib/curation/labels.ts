/**
 * Les mots qui décrivent les recettes de la curation.
 *
 * Ce fichier n'importe RIEN, et c'est sa raison d'être : l'écran
 * /admin/selections tourne dans le navigateur et a besoin de ces
 * libellés. Les lire depuis lib/curation/recipes.ts y embarquerait
 * mongoose, comme lib/ai/labels.ts et lib/sectionPages.ts l'évitent
 * déjà chacun de leur côté.
 *
 * `libelle` sert de deux façons : titre affiché dans les réglages, et
 * titre de repli de la playlist quand l'IA n'écrit pas. Les deux doivent
 * rester compréhensibles seuls, sans le contexte de la page.
 */

export const RECETTES_INFO = {
  top: {
    libelle: "Top de la semaine",
    detail: "Les titres les plus écoutés des sept derniers jours.",
    intention: "le classement des titres les plus écoutés cette semaine",
  },
  trending: {
    libelle: "En pleine montée",
    detail: "Les titres dont l'écoute a le plus progressé par rapport à la semaine précédente.",
    intention: "les titres qui décollent, en nette progression par rapport à la semaine d'avant",
  },
  nouveautes: {
    libelle: "Nouveautés de la semaine",
    detail: "Les titres publiés pendant la fenêtre analysée.",
    intention: "les titres sortis cette semaine",
  },
  recherches: {
    libelle: "Les plus recherchés",
    detail: "Les titres derrière les saisies les plus fréquentes de la recherche.",
    intention: "ce que le public a le plus cherché cette semaine",
  },
  malgache: {
    libelle: "Hits malgaches",
    detail: "Les titres dont la langue déclarée est le malgache, les plus écoutés d'abord.",
    intention: "les meilleurs titres en malgache du moment",
  },
  aimes: {
    libelle: "Les plus aimés",
    detail:
      "Les titres au meilleur rapport « j'aime » sur écoutes. Compteurs cumulés depuis la publication, pas sur la semaine.",
    intention: "les titres que le public aime le plus, proportionnellement à leur écoute",
  },
  genre: {
    libelle: "Le genre de la semaine",
    detail: "Le genre le plus écouté de la fenêtre, et ses meilleurs titres.",
    intention: "le genre qui a dominé l'écoute cette semaine",
  },
} as const;

export type IdRecette = keyof typeof RECETTES_INFO;

export const IDS_RECETTES = Object.keys(RECETTES_INFO) as IdRecette[];

export function estIdRecette(valeur: string): valeur is IdRecette {
  return Object.prototype.hasOwnProperty.call(RECETTES_INFO, valeur);
}

/** Libellé d'une recette, ou l'identifiant brut si elle a disparu du code. */
export function libelleRecette(id: string): string {
  return estIdRecette(id) ? RECETTES_INFO[id].libelle : id;
}
