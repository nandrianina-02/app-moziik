"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CloudOff, Download, Home, Library, RefreshCw } from "lucide-react";
import { listOfflineSongs, type OfflineSongMeta } from "@/lib/offlineCache";
import { compterCacheApi } from "@/lib/offlineApi";

/**
 * Point d'entrée hors-ligne : c'est la page que le service worker rend
 * quand une navigation vise une adresse jamais visitée et que le réseau
 * est absent. Elle est préchargée à l'installation du worker, donc
 * toujours disponible — contrairement aux pages ordinaires, qui ne sont
 * en cache que si elles ont déjà été ouvertes.
 *
 * Elle ne se contente pas d'annoncer la panne : elle dit ce qui reste
 * accessible, ce qui est la seule information utile à ce moment-là.
 */
export default function HorsLignePage() {
  const [morceaux, setMorceaux] = useState<OfflineSongMeta[] | null>(null);
  const [pagesEnCache, setPagesEnCache] = useState<number | null>(null);
  const [enLigne, setEnLigne] = useState(true);

  useEffect(() => {
    setEnLigne(navigator.onLine);
    const majEtat = () => setEnLigne(navigator.onLine);
    window.addEventListener("online", majEtat);
    window.addEventListener("offline", majEtat);

    listOfflineSongs()
      .then(setMorceaux)
      .catch(() => setMorceaux([]));
    compterCacheApi()
      .then(setPagesEnCache)
      .catch(() => setPagesEnCache(0));

    return () => {
      window.removeEventListener("online", majEtat);
      window.removeEventListener("offline", majEtat);
    };
  }, []);

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-5 grid h-16 w-16 place-items-center rounded-full border border-border bg-surface text-ink-muted">
        <CloudOff size={28} />
      </span>

      <h1 className="text-2xl font-display text-ink">
        {enLigne ? "Cette page n’est pas enregistrée" : "Vous êtes hors-ligne"}
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        {enLigne
          ? "La connexion est revenue : rechargez pour retrouver la page demandée."
          : "Moziik fonctionne sans réseau, avec ce qui a déjà été consulté ou téléchargé."}
      </p>

      <div className="mt-7 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl2 border border-border bg-surface p-4 text-left">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <Download size={15} className="text-accent" />
            {morceaux === null ? "—" : morceaux.length} morceau{(morceaux?.length ?? 0) > 1 ? "x" : ""} téléchargé
            {(morceaux?.length ?? 0) > 1 ? "s" : ""}
          </p>
          <p className="mt-1 text-xs text-ink-muted">Écoutables immédiatement, sans réseau.</p>
        </div>
        <div className="rounded-xl2 border border-border bg-surface p-4 text-left">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <Library size={15} className="text-accent" />
            {pagesEnCache === null ? "—" : pagesEnCache} jeu{(pagesEnCache ?? 0) > 1 ? "x" : ""} de données
          </p>
          <p className="mt-1 text-xs text-ink-muted">Les pages déjà ouvertes restent consultables.</p>
        </div>
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
        >
          <RefreshCw size={15} /> Réessayer
        </button>
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"
        >
          <Home size={15} /> Accueil
        </Link>
        <Link
          href="/bibliotheque"
          className="flex items-center gap-1.5 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"
        >
          <Library size={15} /> Ma bibliothèque
        </Link>
      </div>
    </div>
  );
}
