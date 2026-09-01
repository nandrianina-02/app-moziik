import type { EventCategory } from "@/lib/evenements";

/** Un artiste tel que la fiche l'affiche : une photo, un nom, un badge. */
export type ArtisteAffiche = {
  _id: string;
  stageName: string;
  verified?: boolean;
  coverUrl?: string;
  bio?: string;
  socialLinks?: { platform: string; url: string }[];
};

export type CategorieBillet = {
  name: string;
  price: number;
  description?: string;
  originalPrice?: number;
  availableUntil?: string;
  soldOut?: boolean;
};

export type MomentProgramme = {
  time: string;
  title: string;
  detail?: string;
};

/**
 * L'évènement tel que `/api/events/[id]` le renvoie.
 *
 * Presque tout est facultatif : la fiche se remplit de ce qui existe et
 * omet le reste, plutôt que d'afficher des blocs vides.
 */
export type EventDetail = {
  _id: string;
  title: string;
  description: string;
  coverUrl?: string;
  location: string;
  date: string;
  ticketUrl?: string;
  price?: number;
  createdBy: string;
  status: "pending" | "published" | "rejected";
  artist?: ArtisteAffiche | null;

  category?: EventCategory;
  endDate?: string;
  gallery?: string[];
  lineup?: ArtisteAffiche[];
  highlights?: string[];
  inclusions?: string[];
  program?: MomentProgramme[];
  practicalInfo?: string[];
  tickets?: CategorieBillet[];
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  mapsUrl?: string;
  latitude?: number;
  longitude?: number;
  tags?: string[];
  minAge?: number;
  visibility?: "public" | "unlisted";
  organizer?: { name?: string; email?: string; phone?: string; website?: string };

  /** Calculés par l'API à partir de la liste des intéressés, jamais estimés. */
  interestedCount: number;
  viewerInterested: boolean;
};
