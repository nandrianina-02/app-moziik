import type { EventCategory } from "@/lib/evenements";

/**
 * Un évènement tel que `/api/events` le renvoie : de quoi dessiner une
 * ligne de liste, sans les blocs de la fiche détaillée.
 */
export type EventItem = {
  _id: string;
  title: string;
  description: string;
  coverUrl?: string;
  location: string;
  date: string;
  endDate?: string;
  ticketUrl?: string;
  price?: number;
  createdBy: string;
  artist?: { stageName: string; verified?: boolean };
  category?: EventCategory;
  city?: string;
  country?: string;
  /** Dénormalisé par l'API : le nombre de membres intéressés, sans la liste. */
  interestedCount?: number;
};
