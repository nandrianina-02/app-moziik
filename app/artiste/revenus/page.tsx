"use client";

import { useEffect, useState } from "react";
import { Wallet, PlayCircle } from "lucide-react";
import { EqualizerLoader } from "@/components/ui/EqualizerLoader";
import { StatCard } from "@/components/admin/StatCard";
import { useToast } from "@/context/ToastProvider";

type Royalty = {
  _id: string;
  periodStart: string;
  periodEnd: string;
  eligiblePlays: number;
  amountUSD: number;
};

export default function ArtistRevenuePage() {
  const pushToast = useToast();
  const [data, setData] = useState<{ royalties: Royalty[]; totalUSD: number; totalPlays: number } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/artist/revenus");
        if (!res.ok) throw new Error();
        setData(await res.json());
      } catch {
        pushToast("error", "Impossible de charger tes revenus.");
      }
    }
    load();
  }, [pushToast]);

  if (!data) {
    return (
      <div className="px-6 py-8 md:px-10 md:py-10">
        <div className="py-10 grid place-items-center">
          <EqualizerLoader />
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 md:px-10 md:py-10 max-w-2xl">
      <h1 className="text-2xl font-display mb-6">Mes revenus</h1>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <StatCard label="Total cumulé" value={`${data.totalUSD.toFixed(2)} $`} icon={Wallet} />
        <StatCard label="Écoutes rémunérées" value={data.totalPlays} icon={PlayCircle} />
      </div>

      <h2 className="text-sm uppercase tracking-wide text-ink-muted mb-4">Historique des relevés</h2>
      <div className="space-y-2">
        {data.royalties.length === 0 && (
          <p className="text-sm text-ink-muted">Pas encore de relevé. Reviens après tes premières écoutes.</p>
        )}
        {data.royalties.map((r) => (
          <div
            key={r._id}
            className="flex items-center justify-between rounded-xl2 border border-border bg-surface px-4 py-3.5"
          >
            <div>
              <p className="text-sm">
                {new Date(r.periodStart).toLocaleDateString("fr-FR")} → {new Date(r.periodEnd).toLocaleDateString("fr-FR")}
              </p>
              <p className="text-xs text-ink-muted">{r.eligiblePlays} écoute(s)</p>
            </div>
            <span className="text-sm font-medium text-verified">{r.amountUSD.toFixed(2)} $</span>
          </div>
        ))}
      </div>
    </div>
  );
}
