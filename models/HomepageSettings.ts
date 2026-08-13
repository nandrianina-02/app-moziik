import { Schema, models, model, Model } from "mongoose";

export interface IHomepageSettings {
  heroMode: "auto" | "manual";
  theme: "dark" | "light" | "system";
  recommendationMode: "auto" | "manual";
  updatedAt: Date;
}

const HomepageSettingsSchema = new Schema<IHomepageSettings>({
  heroMode: { type: String, enum: ["auto", "manual"], default: "auto" },
  theme: { type: String, enum: ["dark", "light", "system"], default: "system" },
  recommendationMode: { type: String, enum: ["auto", "manual"], default: "auto" },
  updatedAt: { type: Date, default: Date.now },
});

// Un seul document en base, même principe que SiteConfig : id fixe.
export default (models.HomepageSettings as Model<IHomepageSettings>) ||
  model<IHomepageSettings>("HomepageSettings", HomepageSettingsSchema);
