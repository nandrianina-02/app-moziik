"use client";

import Image from "next/image";
import { EqualizerLoader } from "@/components/ui/EqualizerLoader";
import { useSiteConfig } from "@/context/SiteConfigProvider";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const siteConfig = useSiteConfig();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Panneau gauche : image + accroche — masqué sur mobile pour laisser toute la place au formulaire */}
      <div className="relative hidden lg:flex lg:flex-col lg:justify-between overflow-hidden bg-base px-12 py-10">
        <div className="flex items-center gap-2">
          {siteConfig.logoUrl ? (
            <Image src={siteConfig.logoUrl} alt="" width={28} height={28} className="h-7 w-7 object-contain" priority />
          ) : (
            <EqualizerLoader size="sm" />
          )}
          <span className="font-display text-lg">{siteConfig.siteName}</span>
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="font-display text-4xl leading-tight mb-3">
            Toute ta musique.
            <br />
            <span className="text-accent">Partout. À tout moment.</span>
          </h1>
          <p className="text-ink-muted">
            Retrouve tes playlists, tes artistes préférés et bien plus encore.
          </p>
        </div>

        <div className="relative mt-10 flex-1 min-h-0">
          <Image
            src="/marketing/auth-hero.png"
            alt=""
            fill
            className="object-cover object-center rounded-xl2"
            priority
          />
        </div>
      </div>

      {/* Panneau droit : formulaire */}
      <div className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 justify-center lg:hidden">
            {siteConfig.logoUrl ? (
              <Image src={siteConfig.logoUrl} alt="" width={28} height={28} className="h-7 w-7 object-contain" priority />
            ) : (
              <EqualizerLoader size="sm" />
            )}
            <span className="font-display text-lg">{siteConfig.siteName}</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
