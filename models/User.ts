import { Schema, models, model, Types, Model } from "mongoose";

export type UserRole = "member" | "artist" | "admin";

export interface IUser {
  name: string;
  email: string;
  passwordHash?: string; // absent si connexion Google uniquement
  googleId?: string;
  avatarUrl?: string;
  role: UserRole;
  verifiedArtist: boolean;
  suspended: boolean;
  emailVerified: boolean;
  verificationToken?: string;
  verificationTokenExpires?: Date;
  badges: string[];
  likedSongs: Types.ObjectId[];
  savedAlbums: Types.ObjectId[];
  resetToken?: string;
  resetTokenExpires?: Date;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String },
  googleId: { type: String },
  avatarUrl: { type: String },
  role: { type: String, enum: ["member", "artist", "admin"], default: "member" },
  verifiedArtist: { type: Boolean, default: false },
  suspended: { type: Boolean, default: false },
  // Les comptes créés via Google sont considérés vérifiés d'office (Google
  // a déjà confirmé la propriété de l'adresse) ; seuls les comptes créés
  // par email/mot de passe démarrent à `false` et doivent cliquer le lien
  // reçu par email avant de pouvoir se connecter (voir lib/auth.ts).
  emailVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  verificationTokenExpires: { type: Date },
  badges: { type: [String], default: [] },
  likedSongs: [{ type: Schema.Types.ObjectId, ref: "Song" }],
  savedAlbums: [{ type: Schema.Types.ObjectId, ref: "Album" }],
  resetToken: { type: String },
  resetTokenExpires: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

export default (models.User as Model<IUser>) || model<IUser>("User", UserSchema);
