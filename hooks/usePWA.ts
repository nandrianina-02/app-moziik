"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function usePWA() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Silencieux : l'app reste utilisable sans service worker, juste sans mode hors-ligne.
      });
      // Dicte au worker les fichiers de build réellement chargés. Ils
      // transitent par le cache HTTP du navigateur et ne repassent donc
      // jamais par lui : sans cette liste, le bundle manque hors-ligne et
      // la page ne s'hydrate pas (voir le gestionnaire « message » de
      // public/sw.js).
      const signaler = () => {
        const worker = navigator.serviceWorker.controller;
        if (!worker) return;
        const urls = performance
          .getEntriesByType("resource")
          .map((e) => e.name)
          .filter((n) => n.startsWith(location.origin) && n.includes("/_next/static/"));
        if (urls.length > 0) worker.postMessage({ type: "moziik-precharger", urls: [...new Set(urls)] });
      };
      // Après le chargement complet, pour que la liste soit exhaustive, et
      // à chaque prise de contrôle par un nouveau worker.
      if (document.readyState === "complete") setTimeout(signaler, 1200);
      else window.addEventListener("load", () => setTimeout(signaler, 1200), { once: true });
      navigator.serviceWorker.addEventListener("controllerchange", () => setTimeout(signaler, 1200));
    }

    const displayModeStandalone = window.matchMedia("(display-mode: standalone)").matches;
    setIsInstalled(displayModeStandalone);

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    function handleInstalled() {
      setIsInstalled(true);
      setInstallPrompt(null);
    }
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function promptInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setInstallPrompt(null);
  }

  return { canInstall: !!installPrompt && !isInstalled, isInstalled, promptInstall };
}
