/**
 * Urgence et objet d'une demande de support.
 *
 * N'importe RIEN : la boîte de réception tourne dans le navigateur, et
 * importer le classificateur y embarquerait le SDK et mongoose. Même
 * découpage que lib/ai/labels.ts et lib/curation/labels.ts.
 *
 * L'URGENCE N'EST PAS LE TON
 *
 * C'est la distinction qui fait tout l'intérêt de ce tri, et la seule
 * qu'un classement naïf rate. « Je n'arrive plus à me connecter et j'ai
 * payé hier » est écrit calmement et bloque quelqu'un. « Votre appli est
 * nulle » est furieux et n'appelle aucune urgence. Trier sur l'agacement
 * ferait remonter les mécontents et enterrerait les gens en difficulté —
 * exactement l'inverse de ce qu'on veut.
 */

export const URGENCES = ["haute", "normale", "basse"] as const;
export type Urgence = (typeof URGENCES)[number];

export const DESCRIPTION_URGENCES: Record<Urgence, { label: string; detail: string }> = {
  haute: {
    label: "Urgent",
    detail: "Quelqu'un est bloqué, a perdu de l'argent, ou signale un problème de sécurité.",
  },
  normale: {
    label: "Normal",
    detail: "Une question ou une gêne, sans blocage ni perte.",
  },
  basse: {
    label: "Peut attendre",
    detail: "Un avis, une suggestion, un remerciement.",
  },
};

export const CATEGORIES = [
  "compte",
  "paiement",
  "lecture",
  "publication",
  "contenu",
  "suggestion",
  "autre",
] as const;
export type Categorie = (typeof CATEGORIES)[number];

export const LIBELLE_CATEGORIES: Record<Categorie, string> = {
  compte: "Compte et connexion",
  paiement: "Abonnement et paiement",
  lecture: "Lecture et téléchargement",
  publication: "Publication d'un titre",
  contenu: "Signalement de contenu",
  suggestion: "Suggestion",
  autre: "Autre",
};

export function estUrgence(v: string): v is Urgence {
  return (URGENCES as readonly string[]).includes(v);
}

export function estCategorie(v: string): v is Categorie {
  return (CATEGORIES as readonly string[]).includes(v);
}

/** Ordre de tri : le plus urgent d'abord. Sert aussi côté serveur. */
export const RANG_URGENCE: Record<Urgence, number> = { haute: 0, normale: 1, basse: 2 };
