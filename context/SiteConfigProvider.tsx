"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { defaultSiteConfig, type SiteConfig } from "@/config/site";

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
  /**
   * Identifiants des fonctionnalités d'IA servables en ce moment
   * (lib/ai/features.ts). Vide tant que /api/site-config n'a pas répondu,
   * et vide pour de bon si la clé manque ou si l'administration a coupé :
   * les pages n'affichent alors simplement pas le bouton correspondant.
   */
  aiFeatures?: string[];
};

const SiteConfigContext = createContext<PublicSiteConfig>(defaultSiteConfig);

export function SiteConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<PublicSiteConfig>(defaultSiteConfig);

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
 * Cette assistance par IA est-elle proposable ici et maintenant ?
 *
 * Répond false pendant le premier chargement : mieux vaut faire apparaître
 * un bouton une seconde plus tard que d'en afficher un qui échouerait.
 */
export function useIADisponible(fonctionnalite: string): boolean {
  const { aiFeatures } = useContext(SiteConfigContext);
  return Array.isArray(aiFeatures) && aiFeatures.includes(fonctionnalite);
}
