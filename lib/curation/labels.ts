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
 *
 * DEUX JEUX DE NOMS POUR LES MÊMES MESURES
 *
 * L'analyse tourne une fois par univers, sur deux catalogues disjoints.
 * Les mesures sont identiques — le titre le plus écouté reste le titre le
 * plus écouté — mais les noms ne peuvent pas l'être : « Top de la
 * semaine » et « Gospel de la semaine » désignent le même calcul et deux
 * playlists différentes. Le champ `evangelique` porte cette variante ;
 * son absence signifie que le nom convient aux deux.
 */

export const RECETTES_INFO = {
  top: {
    libelle: "Top de la semaine",
    detail: "Les titres les plus écoutés des sept derniers jours.",
    intention: "le classement des titres les plus écoutés cette semaine",
    evangelique: {
      libelle: "Gospel de la semaine",
      intention: "le classement des titres de gospel les plus écoutés cette semaine",
    },
  },
  trending: {
    libelle: "En pleine montée",
    detail: "Les titres dont l'écoute a le plus progressé par rapport à la semaine précédente.",
    intention: "les titres qui décollent, en nette progression par rapport à la semaine d'avant",
    evangelique: {
      libelle: "La louange qui monte",
      intention: "les titres de louange en nette progression par rapport à la semaine d'avant",
    },
  },
  nouveautes: {
    libelle: "Nouveautés de la semaine",
    detail: "Les titres publiés pendant la fenêtre analysée.",
    intention: "les titres sortis cette semaine",
    evangelique: {
      libelle: "Nouveautés chrétiennes",
      intention: "les titres du répertoire chrétien sortis cette semaine",
    },
  },
  recherches: {
    libelle: "Les plus recherchés",
    detail: "Les titres derrière les saisies les plus fréquentes de la recherche.",
    intention: "ce que le public a le plus cherché cette semaine",
    evangelique: {
      libelle: "Les plus recherchés en gospel",
      intention: "ce que le public a le plus cherché cette semaine dans le répertoire chrétien",
    },
  },
  malgache: {
    libelle: "Hits malgaches",
    detail: "Les titres dont la langue déclarée est le malgache, les plus écoutés d'abord.",
    intention: "les meilleurs titres en malgache du moment",
    evangelique: {
      libelle: "Gospel malgache",
      intention: "les meilleurs titres de gospel en malgache du moment",
    },
  },
  aimes: {
    libelle: "Les plus aimés",
    detail:
      "Les titres au meilleur rapport « j'aime » sur écoutes. Compteurs cumulés depuis la publication, pas sur la semaine.",
    intention: "les titres que le public aime le plus, proportionnellement à leur écoute",
    evangelique: {
      libelle: "Louange populaire",
      intention: "les titres de louange que le public aime le plus, proportionnellement à leur écoute",
    },
  },
  genre: {
    libelle: "Le genre de la semaine",
    detail: "Le genre le plus écouté de la fenêtre, et ses meilleurs titres.",
    intention: "le genre qui a dominé l'écoute cette semaine",
  },
  adoration: {
    libelle: "Adoration",
    detail:
      "Les titres lents du répertoire chrétien — tempo sous 85 bpm, ou déclarés adoration. Univers évangélique uniquement.",
    intention: "les titres d'adoration, lents et contemplatifs, à écouter d'affilée",
  },
} as const;

export type IdRecette = keyof typeof RECETTES_INFO;

export const IDS_RECETTES = Object.keys(RECETTES_INFO) as IdRecette[];

export function estIdRecette(valeur: string): valeur is IdRecette {
  return Object.prototype.hasOwnProperty.call(RECETTES_INFO, valeur);
}

/**
 * Libellé d'une recette dans un univers donné, ou l'identifiant brut si
 * elle a disparu du code.
 */
export function libelleRecette(id: string, univers: "general" | "christian" = "general"): string {
  if (!estIdRecette(id)) return id;
  const info = RECETTES_INFO[id] as { libelle: string; evangelique?: { libelle: string } };
  return univers === "christian" && info.evangelique ? info.evangelique.libelle : info.libelle;
}

/** Consigne donnée au modèle pour nommer cette playlist, dans cet univers. */
export function intentionRecette(id: IdRecette, univers: "general" | "christian"): string {
  const info = RECETTES_INFO[id] as { intention: string; evangelique?: { intention: string } };
  return univers === "christian" && info.evangelique ? info.evangelique.intention : info.intention;
}
