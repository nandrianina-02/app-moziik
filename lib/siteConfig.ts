import { connectDB } from "@/lib/db";
import SiteConfigModel from "@/models/SiteConfig";
import { defaultSiteConfig } from "@/config/site";
import { PLAFOND_JOURNALIER_DEFAUT } from "@/lib/ai/features";
import { THEME_PAR_DEFAUT } from "@/lib/theme";
import { UNIVERS_PAR_DEFAUT } from "@/lib/univers";

const SITE_CONFIG_ID = "000000000000000000000001";

/**
 * Valeurs de repli utilisées quand MongoDB est injoignable (ex: build de
 * production lancé sans variable d'environnement DB, ou panne temporaire
 * de la base). Sans ce repli, `getSiteConfig()` lève et fait échouer le
 * prérendu de TOUTES les pages (layout.tsx l'appelle dans generateMetadata),
 * y compris des pages statiques comme /mentions-legales ou /connexion qui
 * n'ont pourtant besoin d'aucune donnée dynamique pour exister.
 */
function fallbackSiteConfig() {
  return {
    _id: SITE_CONFIG_ID,
    siteName: defaultSiteConfig.siteName,
    tagline: defaultSiteConfig.tagline,
    description: "",
    siteUrl: "",
    defaultLanguage: "fr",
    defaultUnivers: UNIVERS_PAR_DEFAUT,
    currency: "EUR",
    timezone: "Indian/Antananarivo",
    dateFormat: "DD/MM/YYYY",
    logoUrl: defaultSiteConfig.logoUrl,
    logoDarkUrl: "",
    faviconUrl: "",
    supportEmail: defaultSiteConfig.supportEmail,
    seoTitle: "",
    seoDescription: "",
    googleAnalyticsId: "",
    googleSearchConsoleId: "",
    trialDays: 0,
    anonymousDailyPlays: 15,
    copyrightText: `© ${new Date().getFullYear()} ${defaultSiteConfig.siteName}. Tous droits réservés.`,
    plans: [
      { plan: "premium" as const, amountUSD: 4.99, amountMGA: 15000 },
      { plan: "premium_annual" as const, amountUSD: 49.99, amountMGA: 150000 },
    ],
    genres: defaultSiteConfig.genres,
    payPerListenRateUSD: 0.003,
    androidApkUrl: "",
    androidVersion: "",
    androidSizeMB: 0,
    // Typée explicitement : sans cela le repli n'a pas ce champ du tout,
    // et la route publique ne compile plus quand elle le lit.
    androidPublishedAt: undefined as Date | undefined,
    androidNotes: "",
    theme: { ...THEME_PAR_DEFAUT },
    legalEntityName: `${defaultSiteConfig.siteName} SAS`,
    legalCapital: "10 000€",
    legalRcsCity: "Antananarivo",
    legalRcsNumber: "123 456 789",
    legalAddress: "Antananarivo, Madagascar",
    legalWebsite: `www.${defaultSiteConfig.siteName.toLowerCase()}.com`,
    legalUpdatedAt: new Date(),
    socialLinks: [] as { platform: string; url: string }[],
    ai: { enabled: true, disabled: [] as string[], dailyCallCap: PLAFOND_JOURNALIER_DEFAUT },
    curation: {
      enabled: true,
      autoPublish: false,
      retentionWeeks: 4,
      disabled: [] as string[],
      sectionPosition: 6,
    },
    updatedAt: new Date(),
  };
}

/**
 * Lit la config du site en base ; crée le document par défaut au premier
 * appel. En cas d'échec de connexion à MongoDB, retourne un objet de repli
 * plutôt que de lever — appelé depuis `generateMetadata` (layout racine),
 * une exception ici ferait échouer le rendu de toute page de l'app.
 */
export async function getSiteConfig() {
  try {
    await connectDB();
  } catch (err) {
    console.error("getSiteConfig: connexion MongoDB indisponible, repli sur la config par défaut.", err);
    return fallbackSiteConfig();
  }

  let config = await SiteConfigModel.findById(SITE_CONFIG_ID);

  if (!config) {
    config = await SiteConfigModel.create({
      _id: SITE_CONFIG_ID,
      siteName: defaultSiteConfig.siteName,
      tagline: defaultSiteConfig.tagline,
      logoUrl: defaultSiteConfig.logoUrl,
      supportEmail: defaultSiteConfig.supportEmail,
      copyrightText: `© ${new Date().getFullYear()} ${defaultSiteConfig.siteName}. Tous droits réservés.`,
      plans: [
        { plan: "premium", amountUSD: 4.99, amountMGA: 15000 },
        { plan: "premium_annual", amountUSD: 49.99, amountMGA: 150000 },
      ],
      genres: defaultSiteConfig.genres,
      legalEntityName: `${defaultSiteConfig.siteName} SAS`,
      legalCapital: "10 000€",
      legalRcsCity: "Antananarivo",
      legalRcsNumber: "123 456 789",
      legalAddress: "Antananarivo, Madagascar",
      legalWebsite: `www.${defaultSiteConfig.siteName.toLowerCase()}.com`,
      legalUpdatedAt: new Date(),
    });
  } else if (!config.genres || config.genres.length === 0) {
    config.genres = defaultSiteConfig.genres;
    await config.save();
  }

  return config;
}
