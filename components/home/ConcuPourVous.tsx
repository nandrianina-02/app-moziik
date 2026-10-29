"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useUnivers } from "@/context/UniversProvider";
import { CarteSelection, type ResumeSelection } from "@/components/selections/CarteSelection";

/**
 * « Conçu pour » : la rangée des sélections personnelles, comme sur la
 * page d'accueil de Spotify. Pour un compte, ses Mix du jour, ses
 * Découvertes de la semaine et son Radar des sorties ; pour un visiteur,
 * les mix communs des genres du catalogue.
 *
 * Une seule rangée qui défile de côté, plutôt qu'une grille : huit
 * sélections en grille repousseraient tout le reste de l'accueil.
 */
export function ConcuPourVous() {
  const { data: session, status } = useSession();
  const { univers } = useUnivers();
  const [selections, setSelections] = useState<ResumeSelection[] | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    const controleur = new AbortController();
    setSelections(null);
    fetch("/api/selections", { signal: controleur.signal })
      .then((r) => (r.ok ? r.json() : { selections: [] }))
      .then((d) => setSelections(d.selections ?? []))
      .catch(() => {});
    return () => controleur.abort();
  }, [status, univers]);

  const connecte = status === "authenticated";
  if (selections !== null && selections.length === 0) return null;

  return (
    <section className="animate-fade-in-up">
      <div className="mb-3">
        <p className="text-sm text-ink-muted">{connecte ? "Conçu pour" : "Pour bien commencer"}</p>
        <h2 className="font-display text-2xl font-bold tracking-tight">{connecte ? session?.user?.name ?? "vous" : "Les mix Moziik"}</h2>
      </div>
      <div className="-mx-2 flex gap-1 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {selections === null
          ? Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="w-40 shrink-0 p-2 sm:w-44 lg:w-48" aria-hidden>
                <div className="aspect-square animate-pulse rounded-md bg-ink/[0.08]" />
                <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-ink/[0.08]" />
                <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-ink/[0.06]" />
              </div>
            ))
          : selections.map((s) => <CarteSelection key={s.cle} s={s} personnel={connecte} />)}
      </div>
    </section>
  );
}
