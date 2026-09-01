"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { defaultSiteConfig, type SiteConfig } from "@/config/site";
import { THEME_PAR_DEFAUT, type ThemePreference } from "@/lib/theme";
import { formatDate } from "@/lib/dates";
import type { Univers } from "@/lib/univers";

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
  /** Univers musical servi par défaut (lib/univers.ts). */
  defaultUnivers?: Univers;
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

type Preferences = { language?: string; timezone?: string; dateFormat?: string; univers?: Univers };

/**
 * Réglages régionaux du compte connecté, s'il en a. Ils recouvrent ceux du
 * site pour l'affichage des dates — le contexte les expose fusionnés, si
 * bien qu'aucun appelant n'a à connaître cette hiérarchie.
 */
const PreferencesContext = createContext<Preferences | null>(null);

export function SiteConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<PublicSiteConfig>(CONFIG_PAR_DEFAUT);
  const [preferences, setPreferences] = useState<Preferences | null>(null);

  const refresh = useCallback(() => {
    fetch("/api/site-config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setConfig(data))
      .catch(() => {
        // repli silencieux sur la config déjà en état
      });
  }, []);

  const relirePreferences = useCallback(() => {
    // La requête part pour tout le monde : ce fournisseur est monté
    // au-dessus de la session, il ne sait pas encore qui regarde. La route
    // répond « aucune préférence » sans erreur pour un visiteur anonyme.
    fetch("/api/me/preferences")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setPreferences(data?.preferences ?? null))
      .catch(() => setPreferences(null));
  }, []);

  useEffect(() => {
    refresh();
    relirePreferences();
    // Déclenché depuis /admin/parametres après un enregistrement réussi,
    // pour que le logo/nom se mette à jour partout sans recharger la page.
    window.addEventListener("moziik-site-config-change", refresh);
    // Déclenché depuis « Mon compte » après un changement de réglages.
    window.addEventListener("moziik-preferences-change", relirePreferences);
    return () => {
      window.removeEventListener("moziik-site-config-change", refresh);
      window.removeEventListener("moziik-preferences-change", relirePreferences);
    };
  }, [refresh, relirePreferences]);

  return (
    <SiteConfigContext.Provider value={config}>
      <PreferencesContext.Provider value={preferences}>{children}</PreferencesContext.Provider>
    </SiteConfigContext.Provider>
  );
}

export const useSiteConfig = () => useContext(SiteConfigContext);

/**
 * Formate une date selon les réglages du site — fuseau, format, langue.
 * À préférer à `toLocaleDateString("fr-FR")` : sans lui, une plateforme
 * réglée sur Antananarivo affiche des dates calculées à Paris.
 */
export function useFormatDate() {
  const { dateFormat, timezone, defaultLanguage } = useSiteConfig();
  const perso = useContext(PreferencesContext);

  // Le compte l'emporte sur le site, champ par champ : quelqu'un peut
  // vouloir son fuseau sans pour autant changer de format de date.
  const format = perso?.dateFormat || dateFormat;
  const fuseau = perso?.timezone || timezone;
  const langue = perso?.language || defaultLanguage;

  return useCallback(
    (valeur: string | number | Date) =>
      formatDate(valeur, { dateFormat: format, timezone: fuseau, defaultLanguage: langue }),
    [format, fuseau, langue]
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

/**
 * Fuseau à utiliser pour écrire une heure : celui du compte s'il en a
 * choisi un, celui du site sinon.
 *
 * Même hiérarchie que `useFormatDate`, mais pour les cas où c'est l'heure
 * qui compte — l'horaire d'un évènement, par exemple, qui doit s'afficher
 * dans le fuseau du lecteur et non dans celui du navigateur.
 */
export function useFuseauHoraire(): string | undefined {
  const { timezone } = useSiteConfig();
  const perso = useContext(PreferencesContext);
  return perso?.timezone || timezone || undefined;
}
