import { Schema, models, model, Types, Model } from "mongoose";

export type UserRole = "member" | "artist" | "admin";

/**
 * Thème personnel, réservé aux comptes Premium (lib/premium.ts).
 *
 * Absent, le compte suit le thème du site. Le champ reste en base même si
 * l'abonnement s'arrête : on rend alors l'apparence du site sans effacer
 * des couleurs que l'auditeur retrouvera s'il se réabonne.
 */
export interface IUserTheme {
  preset: string;
  mode: "dark" | "light" | "system";
  accent: string;
  backgroundDark: string;
  backgroundLight: string;
  secondary: string;
  warning: string;
  radius: number;
}

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
  theme?: IUserTheme;
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
  theme: {
    type: new Schema<IUserTheme>(
      {
        preset: { type: String, required: true },
        mode: { type: String, enum: ["dark", "light", "system"], required: true },
        accent: { type: String, required: true },
        backgroundDark: { type: String, required: true },
        backgroundLight: { type: String, required: true },
        secondary: { type: String, required: true },
        warning: { type: String, required: true },
        radius: { type: Number, required: true, min: 0, max: 24 },
      },
      { _id: false }
    ),
    // Pas de valeur par défaut : « rien » veut dire « suit le site », et
    // c'est une information en soi.
    default: undefined,
  },
  likedSongs: [{ type: Schema.Types.ObjectId, ref: "Song" }],
  savedAlbums: [{ type: Schema.Types.ObjectId, ref: "Album" }],
  resetToken: { type: String },
  resetTokenExpires: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

export default (models.User as Model<IUser>) || model<IUser>("User", UserSchema);
