"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
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
   * L'application Android, quand une version est en ligne.
   *
   * Vide tant qu'aucune n'a été publiée : la page de téléchargement s'en
   * sert pour dire franchement qu'il n'y en a pas encore, plutôt que
   * d'afficher un bouton qui ne mène nulle part.
   */
  androidApkUrl?: string;
  androidVersion?: string;
  androidSizeMB?: number;
  androidPublishedAt?: string;
  androidNotes?: string;
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

export function SiteConfigProvider({
  children,
  initiale,
}: {
  children: React.ReactNode;
  /** Écrite dans la page par le layout : rien à attendre au premier affichage. */
  initiale?: Partial<PublicSiteConfig>;
}) {
  const [config, setConfig] = useState<PublicSiteConfig>(() => (initiale ? { ...CONFIG_PAR_DEFAUT, ...initiale } : CONFIG_PAR_DEFAUT));
  const [preferences, setPreferences] = useState<Preferences | null>(null);

  // `force` : relecture demandée après une modification. Le réseau de Vercel
  // garde la réponse une minute ; une adresse unique passe outre, pour que
  // l'administrateur voie aussitôt ce qu'il vient d'enregistrer.
  const refresh = useCallback((force?: unknown) => {
    fetch(force ? `/api/site-config?t=${Date.now()}` : "/api/site-config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setConfig(data))
      .catch(() => {
        // repli silencieux sur la config déjà en état
      });
  }, []);

  // Monté sous la session (app/layout.tsx) : un visiteur sans compte n'a
  // pas de préférences, inutile de les demander à chaque page.
  const { status } = useSession();
  const connecte = status === "authenticated";
  const relirePreferences = useCallback(() => {
    if (!connecte) {
      setPreferences(null);
      return;
    }
    fetch("/api/me/preferences")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setPreferences(data?.preferences ?? null))
      .catch(() => setPreferences(null));
  }, [connecte]);

  // Avec la configuration déjà dans la page, la redemander aussitôt ne
  // ferait qu'un aller-retour de plus : seul un changement l'actualise.
  const dejaLa = Boolean(initiale);
  useEffect(() => {
    if (!dejaLa) refresh();
    const relireMaintenant = () => refresh(true);
    relirePreferences();
    // Déclenché depuis /admin/parametres après un enregistrement réussi,
    // pour que le logo/nom se mette à jour partout sans recharger la page.
    window.addEventListener("moziik-site-config-change", relireMaintenant);
    // Déclenché depuis « Mon compte » après un changement de réglages.
    window.addEventListener("moziik-preferences-change", relirePreferences);
    return () => {
      window.removeEventListener("moziik-site-config-change", relireMaintenant);
      window.removeEventListener("moziik-preferences-change", relirePreferences);
    };
  }, [dejaLa, refresh, relirePreferences]);

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
