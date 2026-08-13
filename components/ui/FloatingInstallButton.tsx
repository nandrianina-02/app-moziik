"use client";

import { Download, X, Share } from "lucide-react";
import { useEffect, useState } from "react";
import { usePWA } from "@/hooks/usePWA";
import { useSiteConfig } from "@/context/SiteConfigProvider";

/**
 * Safari (iOS/iPadOS) n'implémente pas `beforeinstallprompt` — Apple ne
 * propose pas d'installation programmatique, uniquement le menu
 * Partager → "Sur l'écran d'accueil". Sans cette détection, le bouton
 * ne s'afficherait tout simplement jamais sur iPhone/iPad.
 */
function useIsIosSafari() {
  const [isIosSafari, setIsIosSafari] = useState(false);
  useEffect(() => {
    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;
    setIsIosSafari(isIos && !isStandalone);
  }, []);
  return isIosSafari;
}

export function FloatingInstallButton() {
  const { canInstall, promptInstall } = usePWA();
  const isIosSafari = useIsIosSafari();
  const [dismissed, setDismissed] = useState(false);
  const siteConfig = useSiteConfig();

  if (dismissed || (!canInstall && !isIosSafari)) return null;

  if (isIosSafari) {
    return (
      <div className="fixed bottom-[9.5rem] md:bottom-24 right-4 left-4 md:left-auto md:w-80 z-40 flex items-center gap-2 rounded-xl2 border border-border bg-surface pl-4 pr-2 py-2.5 shadow-lg print:hidden">
        <Share size={16} className="text-accent shrink-0" />
        <span className="text-xs flex-1">
          Installer {siteConfig.siteName} : appuie sur Partager puis &quot;Sur l&apos;écran d&apos;accueil&quot;
        </span>
        <button onClick={() => setDismissed(true)} aria-label="Fermer" className="text-ink-muted hover:text-ink shrink-0">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-[9.5rem] md:bottom-24 right-4 z-40 flex items-center gap-2 rounded-full border border-border bg-surface pl-4 pr-2 py-2 shadow-lg print:hidden">
      <span className="text-xs">Installer {siteConfig.siteName}</span>
      <button
        onClick={promptInstall}
        aria-label="Installer l'application"
        className="grid h-8 w-8 place-items-center rounded-full bg-accent text-base hover:bg-accent-hover"
      >
        <Download size={14} />
      </button>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Fermer"
        className="text-ink-muted hover:text-ink"
      >
        <X size={14} />
      </button>
    </div>
  );
}
