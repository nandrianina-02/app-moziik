"use client";

import { IconeMarque } from "@/components/layout/Marque";
import { AfficheConnexion } from "@/components/layout/Illustrations";
import { useSiteConfig } from "@/context/SiteConfigProvider";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const siteConfig = useSiteConfig();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Panneau gauche : ce que fait Moziik, en texte et en pictogrammes plutôt qu'en photo.
          Masqué sur mobile pour laisser toute la place au formulaire. */}
      <div className="relative hidden gap-10 overflow-hidden border-r border-border bg-base px-12 py-10 lg:flex lg:flex-col">
        <div className="flex items-center gap-2">
          <IconeMarque taille={30} />
          <span className="font-display text-lg">{siteConfig.siteName}</span>
        </div>

        <AfficheConnexion />
      </div>

      {/* Panneau droit : formulaire */}
      <div className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 justify-center lg:hidden">
            <IconeMarque taille={30} />
            <span className="font-display text-lg">{siteConfig.siteName}</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
