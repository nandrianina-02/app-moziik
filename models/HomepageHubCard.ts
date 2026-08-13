import { Schema, models, model, Model } from "mongoose";

// Les 4 cartes par défaut ("Daily Mix", "Nouveautés", "Top Écoutes",
// "Chill Vibes") peuvent avoir une pochette calculée automatiquement à
// partir du contenu réel (autoKey) tant que l'admin n'a pas uploadé de
// pochette personnalisée. Une carte créée librement par l'admin
// (autoKey absent) n'a que sa pochette manuelle.
export type HomepageHubAutoKey = "daily_mix" | "new_releases" | "top_tracks" | "chill";

export interface IHomepageHubCard {
  title: string;
  subtitle?: string;
  badge?: string; // ex: "01" — grand numéro/label affiché sur la carte
  coverUrl?: string; // pochette choisie par l'admin ; si absente, résolue via autoKey
  linkHref: string;
  autoKey?: HomepageHubAutoKey;
  position: number;
  enabled: boolean;
  createdAt: Date;
}

const HomepageHubCardSchema = new Schema<IHomepageHubCard>({
  title: { type: String, required: true },
  subtitle: { type: String },
  badge: { type: String },
  coverUrl: { type: String },
  linkHref: { type: String, required: true },
  autoKey: { type: String, enum: ["daily_mix", "new_releases", "top_tracks", "chill"] },
  position: { type: Number, required: true, default: 0 },
  enabled: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

HomepageHubCardSchema.index({ position: 1 });

export default (models.HomepageHubCard as Model<IHomepageHubCard>) ||
  model<IHomepageHubCard>("HomepageHubCard", HomepageHubCardSchema);
