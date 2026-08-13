import { Schema, models, model, Types, Model } from "mongoose";

// Un document par appareil connecté. Stocker le hash (pas le token en
// clair) : si la base fuite, les refresh tokens émis restent inutilisables
// tels quels, comme pour un mot de passe.
export interface IRefreshToken {
  user: Types.ObjectId;
  tokenHash: string;
  device?: string; // libellé libre (ex: "iPhone 14 - app Moziik")
  revoked: boolean;
  expiresAt: Date;
  createdAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshToken>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  device: { type: String },
  revoked: { type: Boolean, default: false },
  // TTL index : Mongo supprime automatiquement le document une fois expiré,
  // pas besoin d'un job de nettoyage séparé.
  expiresAt: { type: Date, required: true, expires: 0 },
  createdAt: { type: Date, default: Date.now },
});

export default (models.RefreshToken as Model<IRefreshToken>) ||
  model<IRefreshToken>("RefreshToken", RefreshTokenSchema);
