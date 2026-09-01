import { Schema, models, model, Types, Model } from "mongoose";
import { EVENT_CATEGORIES, type EventCategory } from "@/lib/evenements";

export type EventStatus = "pending" | "published" | "rejected";

/** Une ligne de la billetterie. Informative : l'achat se fait chez l'organisateur. */
export interface ITicketTier {
  name: string;
  price: number;
  /** Ce que la place donne : « Accès général », « Accès prioritaire + espace VIP »… */
  description?: string;
  /** Prix barré, quand cette catégorie est une offre de lancement. */
  originalPrice?: number;
  /** Date limite affichée sous le libellé (« Jusqu'au 10 mai »). */
  availableUntil?: Date;
  soldOut?: boolean;
}

/**
 * Qui organise, et comment le joindre.
 *
 * Un évènement porté par un artiste emprunte son profil ; ceux que
 * l'administration crée n'ont personne derrière, et affichaient jusqu'ici
 * la plateforme elle-même avec son adresse de support — rarement le bon
 * interlocuteur pour une question de billetterie.
 */
export interface IOrganizer {
  name?: string;
  email?: string;
  phone?: string;
  website?: string;
}

/** Un moment du déroulé, tel que l'organisateur l'annonce. */
export interface IProgramSlot {
  /** Heure libre, écrite par l'organisateur : « 18:00 », « 22 h 30 ». */
  time: string;
  title: string;
  detail?: string;
}

export interface IEvent {
  title: string;
  description: string;
  coverUrl?: string;
  location: string;
  date: Date;
  ticketUrl?: string;
  price?: number;
  createdBy: Types.ObjectId; // ref User (admin ou artiste autorisé)
  artist?: Types.ObjectId; // ref Artist, si porté par un artiste
  status: EventStatus; // les évènements d'artistes passent par une validation admin
  approvedBy?: Types.ObjectId;
  createdAt: Date;

  // ---- Fiche détaillée --------------------------------------------------
  // Tout ce qui suit est facultatif : une fiche remplie au minimum reste
  // parfaitement lisible, chaque bloc de la page disparaissant faute de
  // matière plutôt que de s'afficher vide.

  category?: EventCategory;
  /** Heure de fin annoncée. Absente, la page n'affiche qu'une heure de début. */
  endDate?: Date;
  /** Photos supplémentaires, montrées en bandeau de miniatures sous l'affiche. */
  gallery: string[];
  /** Artistes à l'affiche, au-delà de celui qui porte l'évènement. */
  lineup: Types.ObjectId[]; // ref Artist
  /** Points saillants en pastilles : « 2 scènes », « 6 h de musique »… */
  highlights: string[];
  /** Ce que comprend l'évènement, en liste à puces sous la description. */
  inclusions: string[];
  /** Déroulé heure par heure. */
  program: IProgramSlot[];
  /** Bon à savoir : âge minimum, objets interdits, accès… */
  practicalInfo: string[];
  /** Catégories de billets, à titre indicatif. */
  tickets: ITicketTier[];
  /** Rue et numéro, sous le nom du lieu. */
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  /**
   * Lien de carte fourni par l'organisateur (Google Maps le plus souvent).
   * Il remplace le lien calculé, sans remplacer les coordonnées : celles-ci
   * seules permettent d'afficher un fond de carte dans la page.
   */
  mapsUrl?: string;
  /**
   * Coordonnées du lieu. Les deux ensemble, ou aucune : la carte n'est
   * affichée que si le point existe vraiment.
   */
  latitude?: number;
  longitude?: number;
  /** Mots-clés libres, pour retrouver l'évènement et le situer d'un coup d'œil. */
  tags: string[];
  /** Âge minimum requis, affiché parmi les infos pratiques. */
  minAge?: number;
  /**
   * `unlisted` : la fiche reste accessible par son lien, mais l'évènement
   * ne figure ni dans les listes, ni dans la recherche, ni dans le sitemap.
   * De quoi préparer une annonce, ou réserver une soirée à ceux qui ont
   * reçu le lien.
   */
  visibility: "public" | "unlisted";
  organizer?: IOrganizer;
  /** Membres qui se déclarent intéressés — la source du compteur de la page. */
  interested: Types.ObjectId[];
}

const TicketTierSchema = new Schema<ITicketTier>(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    description: { type: String },
    originalPrice: { type: Number, min: 0 },
    availableUntil: { type: Date },
    soldOut: { type: Boolean, default: false },
  },
  { _id: false }
);

const OrganizerSchema = new Schema<IOrganizer>(
  {
    name: { type: String },
    email: { type: String },
    phone: { type: String },
    website: { type: String },
  },
  { _id: false }
);

const ProgramSlotSchema = new Schema<IProgramSlot>(
  {
    time: { type: String, required: true },
    title: { type: String, required: true },
    detail: { type: String },
  },
  { _id: false }
);

const EventSchema = new Schema<IEvent>({
  title: { type: String, required: true },
  description: { type: String, required: true },
  coverUrl: { type: String },
  location: { type: String, required: true },
  date: { type: Date, required: true },
  ticketUrl: { type: String },
  price: { type: Number },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  artist: { type: Schema.Types.ObjectId, ref: "Artist", index: true },
  status: { type: String, enum: ["pending", "published", "rejected"], default: "pending" },
  approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },

  category: { type: String, enum: EVENT_CATEGORIES },
  endDate: { type: Date },
  gallery: { type: [String], default: [] },
  lineup: [{ type: Schema.Types.ObjectId, ref: "Artist" }],
  highlights: { type: [String], default: [] },
  inclusions: { type: [String], default: [] },
  program: { type: [ProgramSlotSchema], default: [] },
  practicalInfo: { type: [String], default: [] },
  tickets: { type: [TicketTierSchema], default: [] },
  address: { type: String },
  postalCode: { type: String },
  city: { type: String },
  country: { type: String },
  mapsUrl: { type: String },
  latitude: { type: Number },
  longitude: { type: Number },
  tags: { type: [String], default: [] },
  minAge: { type: Number },
  visibility: { type: String, enum: ["public", "unlisted"], default: "public", index: true },
  organizer: { type: OrganizerSchema },
  interested: [{ type: Schema.Types.ObjectId, ref: "User" }],
});

// Requête la plus fréquente de tout le projet pour ce modèle : les
// évènements publiés à venir, triés par date (page évènements, moteur
// de la page d'accueil, radio). La modération admin filtre aussi par
// status seul ("pending"), déjà couvert par le préfixe de cet index.
EventSchema.index({ status: 1, date: 1 });

// L'administration filtre par catégorie et trie par date ; le public liste
// par catégorie dans l'ordre chronologique. Même besoin des deux côtés.
EventSchema.index({ status: 1, category: 1, date: 1 });

export default (models.Event as Model<IEvent>) || model<IEvent>("Event", EventSchema);
