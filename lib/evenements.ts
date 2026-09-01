/**
 * Catégories d'évènements.
 *
 * Volontairement séparé de `models/Event.ts` : la liste est lue par les
 * formulaires et les cartes, côté navigateur. Importée depuis le modèle,
 * elle y aurait entraîné mongoose tout entier — le même raisonnement que
 * pour `lib/univers.ts`.
 */

export type EventCategory =
  | "musique"
  | "concert"
  | "festival"
  | "culte"
  | "conference"
  | "atelier"
  | "autre";

export const EVENT_CATEGORIES: EventCategory[] = [
  "musique",
  "concert",
  "festival",
  "culte",
  "conference",
  "atelier",
  "autre",
];

export const LIBELLES_CATEGORIE: Record<EventCategory, string> = {
  musique: "Musique",
  concert: "Concert",
  festival: "Festival",
  culte: "Culte",
  conference: "Conférence",
  atelier: "Atelier",
  autre: "Évènement",
};

/** Le libellé d'une catégorie, y compris quand elle n'est pas renseignée. */
export function libelleCategorie(categorie?: string | null): string {
  if (categorie && categorie in LIBELLES_CATEGORIE) {
    return LIBELLES_CATEGORIE[categorie as EventCategory];
  }
  return LIBELLES_CATEGORIE.autre;
}
