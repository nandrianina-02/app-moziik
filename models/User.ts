import { Schema, models, model, Types, Model } from "mongoose";
import { UNIVERS, type Univers } from "@/lib/univers";
import { MODES } from "@/lib/modes";

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

/**
 * Réglages régionaux propres à un compte. Absents, ceux du site
 * s'appliquent (SiteConfig) — c'est une préférence, pas une obligation.
 */
export interface IUserPreferences {
  language?: string;
  timezone?: string;
  dateFormat?: string;
  /**
   * Univers musical du compte : général ou évangélique.
   *
   * Absent, le compte suit l'univers par défaut du site. Le choix est
   * aussi porté par un cookie (lib/univers.ts) pour que le serveur
   * puisse filtrer sans lire la base à chaque requête ; la base, elle,
   * le fait suivre d'un appareil à l'autre.
   */
  univers?: Univers;
  /**
   * Mode d'écoute retenu par le compte, ou « auto » quand l'heure locale
   * décide. Voyage avec le compte, comme l'univers.
   */
  mode?: string;
}

export interface IUser {
  name: string;
  /**
   * Adresse publique du compte : mentions dans les commentaires, page
   * /membre/<username>, recherche. Facultatif en base — les comptes
   * antérieurs à ce champ en reçoivent un à leur première lecture
   * (lib/username.ts).
   */
  username?: string;
  email: string;
  /** Numéro de téléphone, saisi pour le paiement mobile. */
  phone?: string;
  preferences?: IUserPreferences;
  /** Dernière connexion réussie, écrite par lib/auth.ts. */
  lastLoginAt?: Date;
  /**
   * Instant de la dernière déconnexion générale demandée par le compte.
   * Toute session émise avant est refusée à la revalidation : c'est ce qui
   * permet de couper les sessions web, qui sont des JWT sans état côté
   * serveur et ne peuvent donc pas être supprimées une à une.
   */
  sessionsRevokedAt?: Date;
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
  // `sparse` : sans lui, l'index unique refuserait le deuxième compte sans
  // nom d'utilisateur, deux `null` étant considérés comme un doublon.
  username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String },
  preferences: {
    type: new Schema<IUserPreferences>(
      {
        language: { type: String },
        timezone: { type: String },
        dateFormat: { type: String },
        univers: { type: String, enum: UNIVERS },
        mode: { type: String, enum: [...MODES, "auto"] },
      },
      { _id: false }
    ),
    default: undefined,
  },
  lastLoginAt: { type: Date },
  sessionsRevokedAt: { type: Date },
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
