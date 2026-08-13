import { Schema, models, model, Model } from "mongoose";

export type BadgeCategory = "member" | "artist" | "achievement";

export interface IBadge {
  key: string; // identifiant stable, ex: "verified_artist", "top_listener"
  label: string;
  description: string;
  icon: string; // nom d'icône lucide-react
  category: BadgeCategory;
  createdAt: Date;
}

const BadgeSchema = new Schema<IBadge>({
  key: { type: String, required: true, unique: true },
  label: { type: String, required: true },
  description: { type: String, required: true },
  icon: { type: String, required: true },
  category: { type: String, enum: ["member", "artist", "achievement"], default: "member" },
  createdAt: { type: Date, default: Date.now },
});

export default (models.Badge as Model<IBadge>) || model<IBadge>("Badge", BadgeSchema);
