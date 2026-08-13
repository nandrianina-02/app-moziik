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
> & { copyrightText?: string; legalUpdatedAt?: string };

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
