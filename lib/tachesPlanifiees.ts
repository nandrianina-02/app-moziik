/**
 * Les tâches déclenchées par l'ordonnanceur externe.
 *
 * Décrites une fois, et lues aussi bien par l'écran d'administration que
 * par la route qui les lance. Les horaires sont ceux du README : ils
 * documentent ce que l'ordonnanceur est censé faire, ils ne le pilotent
 * pas — c'est chez lui que la planification vit réellement.
 */

export type IdTache =
  | "publish-songs"
  | "moderate-comments"
  | "compute-royalties"
  | "weekly-curation"
  | "weekly-report";

export type TachePlanifiee = {
  id: IdTache;
  titre: string;
  /** Ce qu'elle fait, en une phrase. */
  resume: string;
  /** Ce qui se passe si elle ne tourne pas. */
  enjeu: string;
  /** L'horaire attendu chez l'ordonnanceur, en UTC. */
  horaire: string;
  /** Vrai si la relancer deux fois de suite est sans conséquence. */
  rejouable: boolean;
  /** Accepte de ne traiter qu'un seul univers. */
  parUnivers?: boolean;
};

export const TACHES_PLANIFIEES: TachePlanifiee[] = [
  {
    id: "publish-songs",
    titre: "Publier les sorties programmées",
    resume:
      "Met en ligne les titres dont la date de sortie est passée et prévient les abonnés de l'artiste.",
    enjeu: "Sans elle, une sortie programmée ne sort jamais : elle reste en attente indéfiniment.",
    horaire: "Toutes les 5 minutes",
    rejouable: true,
  },
  {
    id: "compute-royalties",
    titre: "Calculer les droits",
    resume:
      "Regroupe les écoutes complètes non encore payées par artiste et écrit un relevé au tarif courant.",
    enjeu: "Sans elle, personne n'est payé.",
    horaire: "Chaque nuit à 02 h 15 UTC",
    // La tâche réserve les écoutes avant de calculer : deux exécutions ne
    // peuvent pas payer les mêmes.
    rejouable: true,
  },
  {
    id: "moderate-comments",
    titre: "Relire les commentaires",
    resume: "Envoie trente commentaires au modèle et alimente la file de modération.",
    enjeu: "Facultative : la file se rattrape à l'ouverture de l'écran des commentaires.",
    horaire: "Toutes les heures",
    rejouable: true,
  },
  {
    id: "weekly-curation",
    titre: "Sélections de la semaine",
    resume:
      "Produit les sélections et les playlists de modes pour les deux univers. Rien n'apparaît en ligne avant validation.",
    enjeu: "Sans elle, les sélections de la semaine ne sont pas proposées.",
    horaire: "Le lundi à 03 h 00 UTC",
    // Un verrou de quinze minutes refuse une seconde analyse simultanée.
    rejouable: false,
    parUnivers: true,
  },
  {
    id: "weekly-report",
    titre: "Rapport d'exploitation",
    resume: "Archive le rapport de la semaine et prévient les administrateurs.",
    enjeu: "Sans elle, il manque un rapport ; le suivant le remplace.",
    horaire: "Le lundi à 03 h 45 UTC",
    rejouable: true,
  },
];

export function estTachePlanifiee(valeur: string): valeur is IdTache {
  return TACHES_PLANIFIEES.some((t) => t.id === valeur);
}
