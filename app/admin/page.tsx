"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarClock, CheckCircle2, Copy, Inbox, Tags, TrendingDown, TrendingUp, Wand2, type LucideIcon } from "lucide-react";
import { AdminStatsSkeleton, AdminPanelSkeleton } from "@/components/admin/AdminSkeleton";
import { Sparkline } from "@/components/admin/Sparkline";
import { AreaChart } from "@/components/admin/AreaChart";
import { useATraiter } from "@/components/admin/ATraiter";
import { useToast } from "@/context/ToastProvider";

type Stats = {
  members: number;
  artists: number;
  publishedSongs: number;
  pendingSongs: number;
  pendingEvents: number;
  activeSubscriptions: number;
  albumsCount: number;
  playlistsCount: number;
  trends: { members: number | null; artists: number | null; songs: number | null; subscriptions: number | null };
  sparklines: { members: number[]; artists: number[]; songs: number[] };
  signupsEvolution: number[];
  contentBreakdown: { label: string; count: number }[];
  recentActivity: { type: string; message: string; at: string }[];
};

/** La liste de travail : ce qui attend une décision, dans l'ordre où il vaut mieux le traiter. */
const FILES: { href: string; libelle: (n: number) => string; icon: LucideIcon }[] = [
  { href: "/admin/messages", libelle: (n) => `${n} message${n > 1 ? "s" : ""} non lu${n > 1 ? "s" : ""}`, icon: Inbox },
  { href: "/admin/selections", libelle: (n) => `${n} sélection${n > 1 ? "s" : ""} automatique${n > 1 ? "s" : ""} à valider`, icon: Wand2 },
  { href: "/admin/doublons", libelle: (n) => `${n} doublon${n > 1 ? "s" : ""} possible${n > 1 ? "s" : ""}`, icon: Copy },
  { href: "/admin/genres", libelle: (n) => `${n} genre${n > 1 ? "s" : ""} proposé${n > 1 ? "s" : ""} à valider`, icon: Tags },
  { href: "/admin/annees", libelle: (n) => `${n} année${n > 1 ? "s" : ""} de sortie à vérifier`, icon: CalendarClock },
];

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 1) return "à l'instant";
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function Tendance({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-ink-muted">Pas de comparaison possible</span>;
  const hausse = pct >= 0;
  return (
    <span className="flex items-center gap-1 text-ink-muted">
      {hausse ? <TrendingUp size={12} className="text-accent" /> : <TrendingDown size={12} />}
      <span className="tabular-nums text-ink">
        {hausse ? "+" : ""}
        {pct.toFixed(0)} %
      </span>
      sur un mois
    </span>
  );
}

/** Un bloc titré, séparé du reste par un filet plutôt que par une carte. */
function Bloc({ titre, children, className = "" }: { titre: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`animate-fade-in-up ${className}`}>
      <h2 className="mb-3 border-b border-border pb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">{titre}</h2>
      {children}
    </section>
  );
}

export default function AdminDashboardPage() {
  const pushToast = useToast();
  const compteurs = useATraiter();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/stats");
        if (!res.ok) throw new Error();
        setStats(await res.json());
      } catch {
        pushToast("error", "Impossible de charger les statistiques.");
      }
    }
    load();
  }, [pushToast]);

  if (!stats) {
    return (
      <div className="space-y-6">
        <AdminStatsSkeleton count={4} />
        <div className="grid gap-4 lg:grid-cols-2">
          <AdminPanelSkeleton />
          <AdminPanelSkeleton />
        </div>
      </div>
    );
  }

  const evolutionLabels = stats.signupsEvolution.map((_, i) => {
    const date = new Date(Date.now() - (stats.signupsEvolution.length - 1 - i) * 24 * 60 * 60 * 1000);
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  });
  const files = FILES.map((f) => ({ ...f, n: compteurs[f.href] ?? 0 })).filter((f) => f.n > 0);
  const contenuMax = Math.max(1, ...stats.contentBreakdown.map((s) => s.count));

  const chiffres = [
    { label: "Membres", valeur: stats.members, tendance: stats.trends.members, courbe: stats.sparklines.members },
    { label: "Artistes", valeur: stats.artists, tendance: stats.trends.artists, courbe: stats.sparklines.artists },
    { label: "Titres publiés", valeur: stats.publishedSongs, tendance: stats.trends.songs, courbe: stats.sparklines.songs },
    { label: "Abonnés Premium", valeur: stats.activeSubscriptions, tendance: stats.trends.subscriptions, courbe: null },
  ];

  return (
    <div className="space-y-10">
      {/* Les chiffres clés, sur une seule bande : les filets entre les cases
          sont l'écart de la grille, laissé à la couleur des bordures. */}
      <div className="grid grid-cols-2 gap-px border-y border-border bg-border xl:grid-cols-4">
        {chiffres.map((c) => (
          <div key={c.label} className="flex flex-col gap-2 bg-base px-4 py-5 animate-fade-in-up xl:px-6">
            <p className="text-xs text-ink-muted">{c.label}</p>
            <div className="flex items-end justify-between gap-3">
              <p className="text-3xl font-display tabular-nums leading-none">{c.valeur.toLocaleString("fr-FR")}</p>
              {c.courbe && c.courbe.some((v) => v > 0) && <Sparkline values={c.courbe} />}
            </div>
            <div className="text-xs">
              <Tendance pct={c.tendance} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-10">
          <Bloc titre="À traiter">
            {files.length === 0 ? (
              <p className="flex items-center gap-2 py-2 text-sm text-ink-muted">
                <CheckCircle2 size={15} className="text-accent" />
                Rien n&apos;attend de décision pour l&apos;instant.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {files.map(({ href, libelle, icon: Icone, n }) => (
                  <li key={href}>
                    <Link href={href} className="group flex items-center gap-3 py-3 text-sm transition-colors hover:text-accent">
                      <Icone size={16} className="shrink-0 text-ink-muted group-hover:text-accent" />
                      <span className="flex-1">{libelle(n)}</span>
                      <ArrowRight size={15} className="text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Bloc>

          <Bloc titre="Inscriptions, trente derniers jours">
            <AreaChart values={stats.signupsEvolution} labels={evolutionLabels} />
          </Bloc>
        </div>

        <div className="space-y-10">
          <Bloc titre="Contenu">
            <ul className="space-y-3">
              {stats.contentBreakdown.map((s) => (
                <li key={s.label}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="text-ink">{s.label}</span>
                    <span className="tabular-nums text-ink-muted">{s.count.toLocaleString("fr-FR")}</span>
                  </div>
                  <div className="h-1 bg-border">
                    <div className="h-1 bg-accent" style={{ width: `${(s.count / contenuMax) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Bloc>

          <Bloc titre="Activité récente">
            {stats.recentActivity.length === 0 ? (
              <p className="text-sm text-ink-muted">Rien à signaler pour l&apos;instant.</p>
            ) : (
              <ul className="divide-y divide-border">
                {stats.recentActivity.map((item, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                    <span className="text-ink">{item.message}</span>
                    <span className="shrink-0 whitespace-nowrap text-xs text-ink-muted">{timeAgo(item.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Bloc>
        </div>
      </div>
    </div>
  );
}
