import { Schema, models, model, Types, Model } from "mongoose";

export interface IPlay {
  song: Types.ObjectId;
  user?: Types.ObjectId; // absent si écoute anonyme
  country?: string; // code pays ISO, ex: "MG", "FR"
  city?: string;
  device?: string; // "mobile" | "desktop" | "pwa"
  secondsListened: number;
  completed: boolean; // écoute allant jusqu'au bout (compte pour la monétisation)
  monetized: boolean; // déjà comptabilisée dans la rémunération de l'artiste
  playedAt: Date;
}

const PlaySchema = new Schema<IPlay>({
  song: { type: Schema.Types.ObjectId, ref: "Song", required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: "User", index: true },
  country: { type: String },
  city: { type: String },
  device: { type: String },
  secondsListened: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
  monetized: { type: Boolean, default: false },
  playedAt: { type: Date, default: Date.now, index: true },
});

// Index composés pour les classements journaliers / hebdo / mensuels / annuels
PlaySchema.index({ song: 1, playedAt: -1 });
PlaySchema.index({ country: 1, playedAt: -1 });
// user+playedAt : classement des auditeurs (/api/charts?type=listeners)
// et tout historique personnel groupé par période.
PlaySchema.index({ user: 1, playedAt: -1 });

export default (models.Play as Model<IPlay>) || model<IPlay>("Play", PlaySchema);
