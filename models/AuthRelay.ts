import { Schema, models, model, Types, Model } from "mongoose";

// Code de relais à usage unique, qui sert à faire traverser une session
// depuis le navigateur système vers la WebView de l'app Android.
//
// POURQUOI CE DÉTOUR EXISTE
//
// Google refuse OAuth dans une WebView embarquée (erreur
// `disallowed_useragent`). Capacitor ouvre donc accounts.google.com dans
// Chrome — où la connexion aboutit normalement, mais dépose le cookie de
// session NextAuth dans le pot à cookies de CHROME. La WebView, qui a le
// sien, reste déconnectée.
//
// Ce document est le passeur : émis côté Chrome pour une session déjà
// authentifiée, il est échangé une seule fois côté WebView contre un
// cookie de session équivalent. Le code lui-même ne donne accès à rien
// d'autre.
//
// Durée de vie volontairement minuscule : le code transite par une URL
// (`moziik://auth?code=...`), donc potentiellement par des journaux
// système. Une minute suffit largement au rebond navigateur → app, et
// réduit d'autant la fenêtre d'un rejeu.
export interface IAuthRelay {
  user: Types.ObjectId;
  // Même raisonnement que RefreshToken : on ne stocke que le hash, jamais
  // le code en clair.
  codeHash: string;
  used: boolean;
  expiresAt: Date;
  createdAt: Date;
}

const AuthRelaySchema = new Schema<IAuthRelay>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  codeHash: { type: String, required: true, unique: true },
  // Le document n'est pas supprimé à la consommation : le garder marqué
  // `used` jusqu'à son expiration permet de distinguer « code inconnu »
  // de « code déjà utilisé », et donc de repérer une tentative de rejeu
  // dans les journaux plutôt que de la confondre avec une faute de frappe.
  used: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true, expires: 0 },
  createdAt: { type: Date, default: Date.now },
});

export default (models.AuthRelay as Model<IAuthRelay>) ||
  model<IAuthRelay>("AuthRelay", AuthRelaySchema);
