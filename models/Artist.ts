import { Schema, models, model, Types, Model } from "mongoose";

export interface IArtist {
  user: Types.ObjectId; // référence vers le User (role: "artist")
  stageName: string;
  bio?: string;
  coverUrl?: string; // photo de profil (avatar)
  bannerUrl?: string; // bannière de couverture en haut du profil ; par défaut si absente
  genres: string[];
  socialLinks: { platform: string; url: string }[];
  verified: boolean; // badge artiste vérifié, accordé par un admin
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
  followers: [{ type: Schema.Types.ObjectId, ref: "User" }],
  totalPlays: { type: Number, default: 0 },
  monetizationEnabled: { type: Boolean, default: true },
  eventPublishingAuthorized: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default (models.Artist as Model<IArtist>) || model<IArtist>("Artist", ArtistSchema);
