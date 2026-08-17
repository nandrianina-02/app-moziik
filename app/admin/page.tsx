"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Users, Mic2, Music, Crown, UserPlus, Disc3, CalendarPlus, TrendingUp, TrendingDown, LucideIcon } from "lucide-react";
import { AdminStatsSkeleton, AdminPanelSkeleton } from "@/components/admin/AdminSkeleton";
import { Sparkline } from "@/components/admin/Sparkline";
import { AreaChart } from "@/components/admin/AreaChart";
import { DonutChart } from "@/components/admin/DonutChart";
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

const quickActions = [
  { href: "/admin/membres", label: "Gérer les membres", icon: UserPlus, bg: "bg-accent/10", color: "text-accent" },
  { href: "/admin/musiques", label: "Modérer les musiques", icon: Music, bg: "bg-tint-violet/10", color: "text-tint-violet" },
  { href: "/admin/albums", label: "Gérer les albums", icon: Disc3, bg: "bg-tint-emerald/10", color: "text-tint-emerald" },
  { href: "/admin/evenements", label: "Modérer les évènements", icon: CalendarPlus, bg: "bg-tint-amber/10", color: "text-tint-amber" },
];

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 1) return "à l'instant";
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days}j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function TrendLabel({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-ink-muted">Pas de données le mois dernier</span>;
  const positive = pct >= 0;
  return (
    <span className={`flex items-center gap-1 ${positive ? "text-tint-emerald" : "text-accent"}`}>
      {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {positive ? "+" : ""}
      {pct.toFixed(0)}% ce mois
    </span>
  );
}

export default function AdminDashboardPage() {
  const pushToast = useToast();
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TopStatCard
          icon={Users}
          bg="bg-accent/10"
          color="text-accent"
          sparkColor="rgb(var(--color-accent))"
          label="Membres"
          value={stats.members}
          trend={stats.trends.members}
          sparkline={stats.sparklines.members}
        />
        <TopStatCard
          icon={Mic2}
          bg="bg-tint-violet/10"
          color="text-tint-violet"
          sparkColor="rgb(var(--tint-violet))"
          label="Artistes"
          value={stats.artists}
          trend={stats.trends.artists}
          sparkline={stats.sparklines.artists}
        />
        <TopStatCard
          icon={Music}
          bg="bg-tint-emerald/10"
          color="text-tint-emerald"
          sparkColor="rgb(var(--tint-emerald))"
          label="Musiques"
          value={stats.publishedSongs}
          trend={stats.trends.songs}
          sparkline={stats.sparklines.songs}
        />
        <TopStatCard
          icon={Crown}
          bg="bg-tint-amber/10"
          color="text-tint-amber"
          sparkColor="rgb(var(--tint-amber))"
          label="Abonnements Premium"
          value={stats.activeSubscriptions}
          trend={stats.trends.subscriptions}
          sparkline={null}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <div className="rounded-xl2 border border-border bg-surface p-5">
            <h2 className="mb-4 text-sm font-medium">Évolution des inscriptions</h2>
            <AreaChart values={stats.signupsEvolution} labels={evolutionLabels} />
          </div>

          <div className="rounded-xl2 border border-border bg-surface p-5">
            <h2 className="mb-1 text-sm font-medium">Actions rapides</h2>
            <p className="mb-4 text-xs text-ink-muted">Accès direct aux tâches de modération les plus fréquentes</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {quickActions.map(({ href, label, icon: Icon, bg, color }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm font-medium transition-colors hover:border-accent"
                >
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${bg}`}>
                    <Icon size={16} className={color} />
                  </span>
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl2 border border-border bg-surface p-5">
            <h2 className="mb-4 text-sm font-medium">Répartition du contenu</h2>
            <DonutChart segments={stats.contentBreakdown} />
          </div>

          <div className="rounded-xl2 border border-border bg-surface p-5">
            <h2 className="mb-4 text-sm font-medium">Activités récentes</h2>
            {stats.recentActivity.length === 0 ? (
              <p className="text-sm text-ink-muted">Rien à signaler pour l&apos;instant.</p>
            ) : (
              <ul className="space-y-3">
                {stats.recentActivity.map((item, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-ink">{item.message}</span>
                    <span className="shrink-0 whitespace-nowrap text-xs text-ink-muted">{timeAgo(item.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TopStatCard({
  icon: Icon,
  bg,
  color,
  sparkColor,
  label,
  value,
  trend,
  sparkline,
}: {
  icon: LucideIcon;
  bg: string;
  color: string;
  sparkColor: string;
  label: string;
  value: number;
  trend: number | null;
  sparkline: number[] | null;
}) {
  return (
    <div className="rounded-xl2 border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className={`mb-2 grid h-10 w-10 place-items-center rounded-full ${bg}`}>
            <Icon size={18} className={color} />
          </span>
          <p className="text-xs text-ink-muted">{label}</p>
          <p className="text-2xl font-display">{value}</p>
        </div>
        {sparkline && sparkline.some((v) => v > 0) && <Sparkline values={sparkline} color={sparkColor} />}
      </div>
      <div className="mt-2 text-xs">
        <TrendLabel pct={trend} />
      </div>
    </div>
  );
}
