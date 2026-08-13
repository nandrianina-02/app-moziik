import { Schema, models, model, Model } from "mongoose";

export type HomepageSectionType =
  | "hero"
  | "for_you"
  | "recently_played"
  | "new_releases"
  | "top_tracks"
  | "albums"
  | "trending_artists"
  | "recommendations"
  | "playlists"
  | "genres"
  | "events"
  | "radio"
  | "premium"
  | "activity"
  | "custom";

export type HomepageSectionMode = "auto" | "manual";

export interface IHomepageSectionFilters {
  publicOnly: boolean;
  verifiedOnly: boolean;
  premiumOnly: boolean;
}

export interface IHomepageSection {
  key: HomepageSectionType; // type de section : un des 12 types pilotés par le moteur, ou "custom"
  // identifiant stable et unique de la section, utilisé pour cibler le contenu épinglé.
  // Pour les 12 types fixes, slug === key. Pour "custom", plusieurs sections peuvent
  // coexister, donc slug est généré (ex: "custom-collection-ete").
  slug: string;
  title: string; // libellé affiché, modifiable par l'admin
  enabled: boolean;
  position: number; // ordre d'affichage (drag & drop admin)
  mode: HomepageSectionMode; // auto = alimenté par l'algorithme, manual = uniquement le contenu épinglé
  algorithm: string; // nom de l'algorithme de tri appliqué en mode auto
  limit: number; // nombre d'éléments affichés
  filters: IHomepageSectionFilters;
  createdAt: Date;
  updatedAt: Date;
}

const HomepageSectionSchema = new Schema<IHomepageSection>({
  key: {
    type: String,
    enum: [
      "hero",
      "for_you",
      "recently_played",
      "new_releases",
      "top_tracks",
      "albums",
      "trending_artists",
      "recommendations",
      "playlists",
      "genres",
      "events",
      "radio",
      "premium",
      "activity",
      "custom",
    ],
    required: true,
  },
  slug: { type: String, unique: true, sparse: true },
  title: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  position: { type: Number, required: true, default: 0 },
  mode: { type: String, enum: ["auto", "manual"], default: "auto" },
  algorithm: { type: String, default: "default" },
  limit: { type: Number, default: 8 },
  filters: {
    publicOnly: { type: Boolean, default: true },
    verifiedOnly: { type: Boolean, default: false },
    premiumOnly: { type: Boolean, default: false },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

HomepageSectionSchema.index({ position: 1 });

export default (models.HomepageSection as Model<IHomepageSection>) ||
  model<IHomepageSection>("HomepageSection", HomepageSectionSchema);
