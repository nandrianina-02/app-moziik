import { Schema, models, model, Types, Model } from "mongoose";
import { UNIVERS, UNIVERS_PAR_DEFAUT, type Univers } from "@/lib/univers";

export interface IArtist {
  user: Types.ObjectId; // référence vers le User (role: "artist")
  stageName: string;
  bio?: string;
  coverUrl?: string; // photo de profil (avatar)
  bannerUrl?: string; // bannière de couverture en haut du profil ; par défaut si absente
  genres: string[];
  socialLinks: { platform: string; url: string }[];
  verified: boolean; // badge artiste vérifié, accordé par un admin
  /**
   * Univers musical de l'artiste, et de tous ses titres.
   *
   * C'est ici que le classement se décide vraiment : un artiste
   * évangélique reste dans l'univers chrétien, et ses titres avec lui
   * (lib/universClassify.ts cascade le changement). Un titre ne s'en
   * détache que si un admin le déplace explicitement.
   */
  univers: Univers;
  /** `auto` : reconnu par la détection. `admin` : décidé à la main, jamais réécrit. */
  universSource: "auto" | "admin";
  /** Ce qui a produit le classement automatique, en une phrase, pour l'administration. */
  universMotif?: string;
  followers: Types.ObjectId[]; // Users qui suivent l'artiste
  totalPlays: number;
  monetizationEnabled: boolean;
  eventPublishingAuthorized: boolean; // accordé par un admin
  createdAt: Date;
}

const ArtistSchema = new Schema<IArtist>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  stageName: { type: String, required: true },
  bio: { type: String },
  coverUrl: { type: String },
  bannerUrl: { type: String },
  genres: { type: [String], default: [] },
  socialLinks: [{ platform: String, url: String }],
  verified: { type: Boolean, default: false },
  univers: { type: String, enum: UNIVERS, default: UNIVERS_PAR_DEFAUT, index: true },
  universSource: { type: String, enum: ["auto", "admin"], default: "auto" },
  universMotif: { type: String },
  followers: [{ type: Schema.Types.ObjectId, ref: "User" }],
  totalPlays: { type: Number, default: 0 },
  monetizationEnabled: { type: Boolean, default: true },
  eventPublishingAuthorized: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default (models.Artist as Model<IArtist>) || model<IArtist>("Artist", ArtistSchema);
