import { Schema, models, model, Model } from "mongoose";

export interface IAiSettings {
  /** Coupe tous les appels d'un coup, sans toucher à la clé d'API. */
  enabled: boolean;
  /** Identifiants de lib/ai/features.ts éteints individuellement. */
  disabled: string[];
  /** Appels autorisés par jour UTC, toutes fonctionnalités confondues. 0 = sans plafond. */
  dailyCallCap: number;
}

export interface IPlanPricing {
  plan: "premium" | "premium_annual";
  amountUSD: number; // prix de référence, converti selon la région
  amountMGA: number; // prix pour le paiement mobile local
}

export interface ISiteConfig {
  siteName: string;
  tagline: string;
  logoUrl: string; // hébergé sur Cloudinary
  supportEmail: string;
  copyrightText: string;
  plans: IPlanPricing[]; // coûts d'abonnement, modifiables par l'admin
  // Genres proposés à la publication d'un titre — remplace la liste avant
  // codée en dur et dupliquée dans les pages son/nouveau et son/[id]/modifier.
  genres: string[];
  payPerListenRateUSD: number; // rémunération artiste par écoute complète
  defaultTheme: "dark" | "light";
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
  updatedAt: Date;
}

const SiteConfigSchema = new Schema<ISiteConfig>({
  siteName: { type: String, required: true, default: "Moziik" },
  tagline: { type: String, default: "" },
  logoUrl: { type: String, default: "" },
  supportEmail: { type: String, default: "" },
  copyrightText: { type: String, default: "" },
  plans: [
    {
      plan: { type: String, enum: ["premium", "premium_annual"] },
      amountUSD: Number,
      amountMGA: Number,
    },
  ],
  genres: { type: [String], default: [] },
  payPerListenRateUSD: { type: Number, default: 0.003 },
  defaultTheme: { type: String, enum: ["dark", "light"], default: "dark" },
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
  updatedAt: { type: Date, default: Date.now },
});

// Un seul document en base : on force un id fixe pour le récupérer facilement.
export default (models.SiteConfig as Model<ISiteConfig>) || model<ISiteConfig>("SiteConfig", SiteConfigSchema);
