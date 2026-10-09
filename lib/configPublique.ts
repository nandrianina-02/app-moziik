import { getSiteConfig } from "@/lib/siteConfig";
import { liensSociauxUtilisables } from "@/lib/socialPlatforms";
import { fonctionnalitesIADisponibles } from "@/lib/ai/client";
import { normaliserTheme } from "@/lib/theme";

/**
 * La configuration du site telle que le navigateur la voit : ce qui
 * s'affiche, jamais un réglage d'administration ni un secret.
 *
 * Une seule fabrique pour deux usages : /api/site-config, qui la relit après
 * une modification, et le layout racine, qui l'écrit directement dans la
 * page. Sans cela, chaque visite affichait d'abord le logo et le thème par
 * défaut, puis les remplaçait à l'arrivée de la réponse.
 */
export async function configPublique() {
  const config = await getSiteConfig();
  // Ce que l'IA peut servir maintenant, pour que les pages n'affichent pas
  // un bouton qui repondrait par une erreur. Aucun secret n'y transite :
  // c'est une liste d'identifiants de fonctionnalites.
  const aiFeatures = await fonctionnalitesIADisponibles();
  return {
    aiFeatures,
    siteName: config.siteName,
    tagline: config.tagline,
    description: config.description,
    siteUrl: config.siteUrl,
    defaultLanguage: config.defaultLanguage,
    // L'univers servi à qui n'a rien choisi : le sélecteur s'en sert
    // comme valeur de départ (context/UniversProvider.tsx).
    defaultUnivers: config.defaultUnivers,
    currency: config.currency,
    timezone: config.timezone,
    dateFormat: config.dateFormat,
    logoUrl: config.logoUrl,
    logoDarkUrl: config.logoDarkUrl,
    supportEmail: config.supportEmail,
    copyrightText: config.copyrightText,
    plans: config.plans,
    trialDays: config.trialDays,
    anonymousDailyPlays: config.anonymousDailyPlays,
    genres: config.genres,
    // Le thème par défaut du site : c'est lui que voit tout visiteur qui
    // n'a rien personnalisé, y compris déconnecté.
    theme: normaliserTheme(config.theme),
    legalEntityName: config.legalEntityName,
    legalCapital: config.legalCapital,
    legalRcsCity: config.legalRcsCity,
    legalRcsNumber: config.legalRcsNumber,
    legalAddress: config.legalAddress,
    legalWebsite: config.legalWebsite,
    legalUpdatedAt: config.legalUpdatedAt,
    // L'application : sa présence conditionne l'affichage du bouton de
    // téléchargement, il faut donc que le client la connaisse.
    androidApkUrl: config.androidApkUrl,
    androidVersion: config.androidVersion,
    androidSizeMB: config.androidSizeMB,
    androidPublishedAt: config.androidPublishedAt,
    androidNotes: config.androidNotes,
    // Nettoyes ici et pas seulement a la saisie : la base peut
    // contenir des liens ecrits avant que le schema ne filtre.
    socialLinks: liensSociauxUtilisables(config.socialLinks),
  };
}

export type ConfigPublique = Awaited<ReturnType<typeof configPublique>>;
