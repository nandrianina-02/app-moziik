"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Headphones,
  Heart,
  Music2,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { Skeleton } from "@/components/ui/Skeleton";
import { AreaChart } from "@/components/admin/AreaChart";
import { DonutChart } from "@/components/admin/DonutChart";
import { StatCard } from "@/components/admin/StatCard";
import { useToast } from "@/context/ToastProvider";
import { formatCompactNumber } from "@/lib/formatNumber";
import { readApiError } from "@/lib/readApiError";

/**
 * Les statistiques de l'artiste sur son propre catalogue.
 *
 * L'onglet existait dans la navigation, désactivé, marqué « bientôt
 * disponible ». Tout ce qu'il fallait était déjà en base : les écoutes
 * sont enregistrées depuis le début, avec leur date, leur pays et leur
 * appareil.
 */

type Stats = {
  jours: number;
  catalogue: { titres: number; publies: number };
  abonnes: number;
  resume: {
    ecoutes: number;
    ecoutesPrecedentes: number;
    auditeurs: number;
    favoris: number;
    tauxEcouteComplete: number | null;
  };
  serie: { jour: string; ecoutes: number }[];
  topTitres: { _id: string; title: string; coverUrl?: string; ecoutes: number }[];
  pays: { code: string; ecoutes: number }[];
  appareils: { nom: string; ecoutes: number }[];
};

const PERIODES = [
  { jours: 7, label: "7 jours" },
  { jours: 30, label: "30 jours" },
  { jours: 90, label: "90 jours" },
  { jours: 365, label: "1 an" },
];

const NOMS_APPAREIL: Record<string, string> = {
  mobile: "Mobile",
  desktop: "Ordinateur",
  pwa: "Application",
};

/** Le drapeau d'un code pays ISO, sans table de correspondance. */
function drapeau(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split("")
      .map((c) => 0x1f1a5 + c.charCodeAt(0))
  );
}

function Evolution({ actuel, precedent }: { actuel: number; precedent: number }) {
  // Sans période de comparaison, il n'y a pas d'évolution à annoncer :
  // afficher « +100 % » sur un premier mois serait une invention.
  if (precedent === 0) {
    return <span className="text-ink-muted">{actuel > 0 ? "première période mesurée" : "aucune écoute"}</span>;
  }

  const variation = Math.round(((actuel - precedent) / precedent) * 100);
  if (variation === 0) return <span className="text-ink-muted">stable</span>;

  const monte = variation > 0;
  const Icone = monte ? TrendingUp : TrendingDown;
  return (
    <span className={`flex items-center gap-1 ${monte ? "text-verified" : "text-danger"}`}>
      <Icone size={12} />
      {monte ? "+" : ""}
      {variation} % vs période précédente
    </span>
  );
}

export default function ArtistStatsPage() {
  const pushToast = useToast();
  const [jours, setJours] = useState(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const res = await fetch(`/api/artist/stats?jours=${jours}`);
      if (!res.ok) throw new Error(await readApiError(res, "Chargement impossible."));
      setStats(await res.json());
      setErreur(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chargement impossible.";
      setErreur(message);
      pushToast("error", message);
    } finally {
      setChargement(false);
    }
  }, [jours, pushToast]);

  useEffect(() => {
    charger();
  }, [charger]);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-6 py-8 md:px-10 md:py-10">
      <Link
        href="/artiste/gestion"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} /> Mon espace artiste
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl">Statistiques</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Ce que vos titres ont réellement fait sur la période choisie.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PERIODES.map((p) => (
            <button
              key={p.jours}
              type="button"
              onClick={() => setJours(p.jours)}
              aria-pressed={jours === p.jours}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                jours === p.jours
                  ? "bg-accent text-base"
                  : "border border-border text-ink-muted hover:border-accent hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {erreur && !stats && (
        <p className="rounded-xl2 border border-border bg-surface p-8 text-center text-sm text-ink-muted">
          {erreur}
        </p>
      )}

      {chargement && !stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl2" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl2" />
        </div>
      )}

      {stats && (
        <div className={`space-y-5 ${chargement ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={Headphones}
              label="Écoutes"
              value={formatCompactNumber(stats.resume.ecoutes)}
              bg="bg-accent/10"
              hint={
                <Evolution actuel={stats.resume.ecoutes} precedent={stats.resume.ecoutesPrecedentes} />
              }
            />
            <StatCard
              icon={Users}
              label="Auditeurs"
              value={formatCompactNumber(stats.resume.auditeurs)}
              color="text-tint-sky"
              bg="bg-tint-sky/10"
              hint="Comptes distincts, hors visiteurs"
            />
            <StatCard
              icon={Heart}
              label="Favoris"
              value={formatCompactNumber(stats.resume.favoris)}
              color="text-tint-rose"
              bg="bg-tint-rose/10"
              hint="Sur tout le catalogue"
            />
            <StatCard
              icon={Music2}
              label="Titres publiés"
              value={stats.catalogue.publies}
              color="text-verified"
              bg="bg-verified/10"
              hint={`${stats.abonnes} abonné(s)`}
            />
          </div>

          <section className="rounded-xl2 border border-border bg-surface p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Écoutes par jour</h2>
              {stats.resume.tauxEcouteComplete !== null && (
                <span className="text-xs text-ink-muted">
                  {stats.resume.tauxEcouteComplete} % écoutés jusqu&apos;au bout
                </span>
              )}
            </div>

            {stats.resume.ecoutes === 0 ? (
              <p className="py-10 text-center text-sm text-ink-muted">
                Aucune écoute enregistrée sur cette période.
              </p>
            ) : (
              <AreaChart
                values={stats.serie.map((j) => j.ecoutes)}
                // Étiquettes au format court : la courbe en porte trente,
                // parfois trois cent soixante-cinq.
                labels={stats.serie.map((j) => j.jour.slice(5).replace("-", "/"))}
              />
            )}
          </section>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="rounded-xl2 border border-border bg-surface p-5">
              <h2 className="mb-4 text-sm font-semibold">Titres les plus écoutés</h2>

              {stats.topTitres.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-muted">
                  Rien à classer sur cette période.
                </p>
              ) : (
                <ol className="space-y-2.5">
                  {stats.topTitres.map((titre, index) => {
                    const part = Math.round((titre.ecoutes / stats.topTitres[0].ecoutes) * 100);
                    return (
                      <li key={titre._id} className="flex items-center gap-3">
                        <span className="w-4 shrink-0 text-right text-xs tabular-nums text-ink-muted">
                          {index + 1}
                        </span>
                        <SafeImage
                          src={titre.coverUrl}
                          alt=""
                          width={36}
                          height={36}
                          className="h-9 w-9 shrink-0 rounded-lg object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/son/${titre._id}`}
                            className="block truncate text-sm font-medium transition-colors hover:text-accent"
                          >
                            {titre.title}
                          </Link>
                          {/* La barre situe chaque titre par rapport au
                              premier : un palmarès de nombres nus ne dit
                              pas si l'écart est de deux écoutes ou de mille. */}
                          <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-base">
                            <span
                              className="block h-full rounded-full bg-accent"
                              style={{ width: `${part}%` }}
                            />
                          </span>
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                          {formatCompactNumber(titre.ecoutes)}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            <div className="space-y-5">
              <section className="rounded-xl2 border border-border bg-surface p-5">
                <h2 className="mb-4 text-sm font-semibold">Pays</h2>
                {stats.pays.length === 0 ? (
                  <p className="text-xs text-ink-muted">
                    Aucun pays enregistré : l&apos;origine n&apos;est connue que pour une partie des
                    écoutes.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {stats.pays.map((p) => (
                      <li key={p.code} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate">
                          {drapeau(p.code)} {p.code}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                          {formatCompactNumber(p.ecoutes)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-xl2 border border-border bg-surface p-5">
                <h2 className="mb-4 text-sm font-semibold">Appareils</h2>
                {stats.appareils.length === 0 ? (
                  <p className="text-xs text-ink-muted">Aucun appareil enregistré sur la période.</p>
                ) : (
                  <DonutChart
                    segments={stats.appareils.map((a) => ({
                      label: NOMS_APPAREIL[a.nom] ?? a.nom,
                      count: a.ecoutes,
                    }))}
                  />
                )}
              </section>
            </div>
          </div>

          <p className="flex items-start gap-2.5 rounded-xl2 border border-border bg-base p-4 text-xs text-ink-muted">
            <BarChart3 size={14} className="mt-0.5 shrink-0" />
            Les chiffres viennent des écoutes réellement enregistrées. Le pays et l&apos;appareil ne
            sont connus que lorsque le lecteur a pu les transmettre : leurs totaux sont donc
            inférieurs au nombre d&apos;écoutes.
          </p>
        </div>
      )}
    </div>
  );
}
