"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { defaultSiteConfig, type SiteConfig } from "@/config/site";
import { THEME_PAR_DEFAUT, type ThemePreference } from "@/lib/theme";
import { formatDate } from "@/lib/dates";

type PublicSiteConfig = Pick<
  SiteConfig,
  | "siteName"
  | "tagline"
  | "logoUrl"
  | "supportEmail"
  | "genres"
  | "legalEntityName"
  | "legalCapital"
  | "legalRcsCity"
  | "legalRcsNumber"
  | "legalAddress"
  | "legalWebsite"
  | "socialLinks"
> & {
  copyrightText?: string;
  legalUpdatedAt?: string;
  /** Thème par défaut du site, appliqué par ThemeProvider. */
  theme?: ThemePreference;
  /** Présentation longue, reprise par le référencement à défaut de description SEO. */
  description?: string;
  siteUrl?: string;
  defaultLanguage?: string;
  /** Devise d'affichage des prix internationaux. */
  currency?: string;
  timezone?: string;
  dateFormat?: string;
  /** Variante du logo pour fond sombre. */
  logoDarkUrl?: string;
  /** Jours d'essai offerts sur l'abonnement, 0 si aucun. */
  trialDays?: number;
  /**
   * Identifiants des fonctionnalités d'IA servables en ce moment
   * (lib/ai/features.ts). Vide tant que /api/site-config n'a pas répondu,
   * et vide pour de bon si la clé manque ou si l'administration a coupé :
   * les pages n'affichent alors simplement pas le bouton correspondant.
   */
  aiFeatures?: string[];
};

// `defaultSiteConfig.currency` décrit les deux devises de paiement, là où la
// configuration publique n'en expose qu'une, celle d'affichage : on la
// remplace explicitement plutôt que de laisser passer l'objet.
const CONFIG_PAR_DEFAUT: PublicSiteConfig = { ...defaultSiteConfig, currency: "EUR", theme: THEME_PAR_DEFAUT };

const SiteConfigContext = createContext<PublicSiteConfig>(CONFIG_PAR_DEFAUT);

export function SiteConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<PublicSiteConfig>(CONFIG_PAR_DEFAUT);

  const refresh = useCallback(() => {
    fetch("/api/site-config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setConfig(data))
      .catch(() => {
        // repli silencieux sur la config déjà en état
      });
  }, []);

  useEffect(() => {
    refresh();
    // Déclenché depuis /admin/parametres après un enregistrement réussi,
    // pour que le logo/nom se mette à jour partout sans recharger la page.
    window.addEventListener("moziik-site-config-change", refresh);
    return () => window.removeEventListener("moziik-site-config-change", refresh);
  }, [refresh]);

  return <SiteConfigContext.Provider value={config}>{children}</SiteConfigContext.Provider>;
}

export const useSiteConfig = () => useContext(SiteConfigContext);

/**
 * Formate une date selon les réglages du site — fuseau, format, langue.
 * À préférer à `toLocaleDateString("fr-FR")` : sans lui, une plateforme
 * réglée sur Antananarivo affiche des dates calculées à Paris.
 */
export function useFormatDate() {
  const { dateFormat, timezone, defaultLanguage } = useSiteConfig();
  return useCallback(
    (valeur: string | number | Date) => formatDate(valeur, { dateFormat, timezone, defaultLanguage }),
    [dateFormat, timezone, defaultLanguage]
  );
}

/**
 * Cette assistance par IA est-elle proposable ici et maintenant ?
 *
 * Répond false pendant le premier chargement : mieux vaut faire apparaître
 * un bouton une seconde plus tard que d'en afficher un qui échouerait.
 */
export function useIADisponible(fonctionnalite: string): boolean {
  const { aiFeatures } = useContext(SiteConfigContext);
  return Array.isArray(aiFeatures) && aiFeatures.includes(fonctionnalite);
}
