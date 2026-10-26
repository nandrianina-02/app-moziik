import { Schema, models, model, Types, Model } from "mongoose";

export type PublicAnnonce = "tous" | "artistes" | "premium";

/**
 * Une annonce de la plateforme, envoyée par l'administration : l'historique
 * de la page Annonces. Chaque destinataire en reçoit une notification
 * (type « system », format « riche ») et un push sur ses téléphones.
 */
export interface IAnnonce {
  titre: string;
  /** Texte mis en forme (lib/annonceTexte.ts). */
  message: string;
  lien?: string;
  public: PublicAnnonce;
  destinataires: number;
  auteur: Types.ObjectId;
  createdAt: Date;
}

const AnnonceSchema = new Schema<IAnnonce>({
  titre: { type: String, required: true },
  message: { type: String, required: true },
  lien: { type: String },
  public: { type: String, enum: ["tous", "artistes", "premium"], required: true },
  destinataires: { type: Number, default: 0 },
  auteur: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

export default (models.Annonce as Model<IAnnonce>) || model<IAnnonce>("Annonce", AnnonceSchema);
