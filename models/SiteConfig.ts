import { Schema, models, model, Model } from "mongoose";

export interface IAiSettings {
  /** Coupe tous les appels d'un coup, sans toucher à la clé d'API. */
  enabled: boolean;
  /** Identifiants de lib/ai/features.ts éteints individuellement. */
  disabled: string[];
  /** Appels autorisés par jour UTC, toutes fonctionnalités confondues. 0 = sans plafond. */
  dailyCallCap: number;
}

/**
 * Réglages de la curation hebdomadaire (lib/curation/).
 *
 * `autoPublish` est faux par défaut, et ce défaut est un choix : la
 * demande précise « valider… avant publication ». Une analyse
 * s'exécute donc toute seule chaque semaine, mais rien n'apparaît sur
 * l'accueil tant qu'un humain n'a pas regardé. Qui préfère le
 * fonctionnement entièrement automatique l'active ici en connaissance de
 * cause.
 */
export interface ICurationSettings {
  /** Coupe l'analyse hebdomadaire sans rien désinstaller. */
  enabled: boolean;
  /** Publier sans validation humaine. Faux par défaut. */
  autoPublish: boolean;
  /** Semaines de conservation des playlists archivées que personne ne suit. */
  retentionWeeks: number;
  /** Identifiants de recettes éteintes (lib/curation/recipes.ts). */
  disabled: string[];
  /** Position de la section produite sur l'accueil. */
  sectionPosition: number;
}

/**
 * Thème par défaut du site, celui que voit tout visiteur qui n'a rien
 * personnalisé. Les couleurs libres ne servent que si `preset` vaut
 * "custom" ; sinon le préréglage fait foi (lib/theme.ts).
 */
export interface IThemeSettings {
  preset: string;
  /** "system" délègue au réglage de l'appareil du visiteur. */
  mode: "dark" | "light" | "system";
  accent: string;
  backgroundDark: string;
  backgroundLight: string;
  /** Badges vérifiés, statuts publiés, confirmations. */
  secondary: string;
  /** Avertissements et seuils. */
  warning: string;
  /** Rayon de référence des arrondis, en pixels. */
  radius: number;
}

export interface IPlanPricing {
  plan: "premium" | "premium_annual";
  amountUSD: number; // prix de référence, converti selon la région
  amountMGA: number; // prix pour le paiement mobile local
}

export interface ISiteConfig {
  siteName: string;
  tagline: string; // slogan court, affiché sous le nom
  description: string; // présentation longue, reprise par défaut en méta description
  siteUrl: string; // adresse publique, utilisée par les liens absolus et le sitemap
  defaultLanguage: string; // code ISO posé sur <html lang>
  currency: string; // devise d'affichage des prix (EUR, USD, MGA…)
  timezone: string; // fuseau de référence pour l'affichage des dates
  dateFormat: string; // gabarit d'affichage des dates (voir lib/dates.ts)
  logoUrl: string; // hébergé sur Cloudinary
  logoDarkUrl: string; // variante pour fond sombre ; à défaut, logoUrl sert partout
  faviconUrl: string; // icône d'onglet ; à défaut, dérivée du logo
  supportEmail: string;
  copyrightText: string;
  // Référencement et mesure d'audience
  seoTitle: string; // titre de la page d'accueil dans les résultats de recherche
  seoDescription: string; // description affichée sous ce titre
  googleAnalyticsId: string; // identifiant G-XXXXXXXXXX ; vide = aucun script chargé
  googleSearchConsoleId: string; // jeton de vérification de propriété
  trialDays: number; // jours d'essai offerts sur l'abonnement Premium
  plans: IPlanPricing[]; // coûts d'abonnement, modifiables par l'admin
  // Genres proposés à la publication d'un titre — remplace la liste avant
  // codée en dur et dupliquée dans les pages son/nouveau et son/[id]/modifier.
  genres: string[];
  payPerListenRateUSD: number; // rémunération artiste par écoute complète
  /** Thème par défaut du site — mode et couleurs. */
  theme: IThemeSettings;
  // Mentions légales — éditables dans /admin/parametres, affichées sur /mentions-legales
  legalEntityName: string; // raison sociale complète, ex. "Moziik SAS"
  legalCapital: string; // capital social affiché tel quel, ex. "10 000€"
  legalRcsCity: string; // ville d'immatriculation RCS
  legalRcsNumber: string; // numéro RCS
  legalAddress: string; // adresse du siège affichée dans les mentions légales
  legalWebsite: string; // URL affichée dans les mentions légales
  legalUpdatedAt: Date; // date de "dernière mise à jour" affichée sur la page
  // Réseaux sociaux officiels — affichés sur /contact et dans le pied de
  // page. Le catalogue des plateformes vit dans lib/socialPlatforms.ts.
  socialLinks: { platform: string; url: string }[];
  // Réglages de l'IA. Le catalogue des fonctionnalités vit dans
  // lib/ai/features.ts ; on ne stocke ici que ce que l'administration
  // décide : l'interrupteur général, celles qu'elle éteint une à une, et
  // le plafond d'appels par jour.
  ai: IAiSettings;
  curation: ICurationSettings;
  updatedAt: Date;
}

const SiteConfigSchema = new Schema<ISiteConfig>({
  siteName: { type: String, required: true, default: "Moziik" },
  tagline: { type: String, default: "" },
  description: { type: String, default: "" },
  siteUrl: { type: String, default: "" },
  defaultLanguage: { type: String, default: "fr" },
  currency: { type: String, default: "EUR" },
  timezone: { type: String, default: "Indian/Antananarivo" },
  dateFormat: { type: String, default: "DD/MM/YYYY" },
  logoUrl: { type: String, default: "" },
  logoDarkUrl: { type: String, default: "" },
  faviconUrl: { type: String, default: "" },
  supportEmail: { type: String, default: "" },
  copyrightText: { type: String, default: "" },
  seoTitle: { type: String, default: "" },
  seoDescription: { type: String, default: "" },
  googleAnalyticsId: { type: String, default: "" },
  googleSearchConsoleId: { type: String, default: "" },
  trialDays: { type: Number, default: 0, min: 0, max: 365 },
  plans: [
    {
      plan: { type: String, enum: ["premium", "premium_annual"] },
      amountUSD: Number,
      amountMGA: Number,
    },
  ],
  genres: { type: [String], default: [] },
  payPerListenRateUSD: { type: Number, default: 0.003 },
  theme: {
    type: new Schema<IThemeSettings>(
      {
        preset: { type: String, default: "moziik" },
        mode: { type: String, enum: ["dark", "light", "system"], default: "dark" },
        accent: { type: String, default: "#FF6B4A" },
        backgroundDark: { type: String, default: "#0D0F1A" },
        backgroundLight: { type: String, default: "#FBF9F4" },
        secondary: { type: String, default: "#3DDC97" },
        warning: { type: String, default: "#FBBF24" },
        radius: { type: Number, default: 12, min: 0, max: 24 },
      },
      { _id: false }
    ),
    default: () => ({
      preset: "moziik",
      mode: "dark",
      accent: "#FF6B4A",
      backgroundDark: "#0D0F1A",
      backgroundLight: "#FBF9F4",
      secondary: "#3DDC97",
      warning: "#FBBF24",
      radius: 12,
    }),
  },
  legalEntityName: { type: String, default: "" },
  legalCapital: { type: String, default: "" },
  legalRcsCity: { type: String, default: "" },
  legalRcsNumber: { type: String, default: "" },
  legalAddress: { type: String, default: "" },
  legalWebsite: { type: String, default: "" },
  legalUpdatedAt: { type: Date, default: Date.now },
  socialLinks: {
    type: [{ platform: { type: String, required: true }, url: { type: String, required: true } }],
    default: [],
  },
  // Allumée par défaut : la clé d'API n'est renseignée que par quelqu'un
  // qui veut l'IA, et une fonctionnalité qu'il faut aller activer après
  // l'avoir installée passe pour cassée. Le plafond, lui, existe dès le
  // premier appel — c'est le garde-fou qui rend ce défaut acceptable.
  ai: {
    type: new Schema<IAiSettings>(
      {
        enabled: { type: Boolean, default: true },
        disabled: { type: [String], default: [] },
        dailyCallCap: { type: Number, default: 1000, min: 0 },
      },
      { _id: false }
    ),
    default: () => ({ enabled: true, disabled: [], dailyCallCap: 1000 }),
  },
  curation: {
    type: new Schema<ICurationSettings>(
      {
        enabled: { type: Boolean, default: true },
        autoPublish: { type: Boolean, default: false },
        retentionWeeks: { type: Number, default: 4, min: 1, max: 52 },
        disabled: { type: [String], default: [] },
        sectionPosition: { type: Number, default: 6, min: 0, max: 50 },
      },
      { _id: false }
    ),
    default: () => ({
      enabled: true,
      autoPublish: false,
      retentionWeeks: 4,
      disabled: [],
      sectionPosition: 6,
    }),
  },
  updatedAt: { type: Date, default: Date.now },
});

// Un seul document en base : on force un id fixe pour le récupérer facilement.
export default (models.SiteConfig as Model<ISiteConfig>) || model<ISiteConfig>("SiteConfig", SiteConfigSchema);
