"use client";

import Image from "next/image";
import { useTheme } from "@/context/ThemeProvider";
import { useSiteConfig } from "@/context/SiteConfigProvider";

/**
 * L'icône de Moziik : le carré orange au M et à la note, la même que
 * l'application Android. C'est l'identité du site ; un logo déposé dans
 * l'administration la remplace, un logo sombre aussi sur fond sombre.
 */
export const ICONE_MARQUE = "/icon-mark.png";

export function IconeMarque({ taille = 28, className = "" }: { taille?: number; className?: string }) {
  const siteConfig = useSiteConfig();
  const { theme } = useTheme();
  const source = (theme === "dark" && siteConfig.logoDarkUrl) || siteConfig.logoUrl || ICONE_MARQUE;
  return (
    <Image
      src={source}
      alt=""
      width={taille}
      height={taille}
      priority
      // Le carré plein de l'icône, arrondi comme sur l'écran d'accueil d'un téléphone.
      className={`shrink-0 rounded-[22%] object-cover ${className}`}
      style={{ width: taille, height: taille }}
    />
  );
}
