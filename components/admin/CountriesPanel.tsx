"use client";

import { useEffect, useState } from "react";
import { Globe2 } from "lucide-react";
import { AdminCard } from "@/components/admin/AdminChrome";
import { AdminPanelSkeleton } from "@/components/admin/AdminSkeleton";
import { formatCompactNumber } from "@/lib/formatNumber";

type Pays = { code: string | null; plays: number; listeners: number; share: number };

const FENETRES = [7, 30, 90];

/**
 * Le pays d'où l'on écoute, relevé automatiquement à chaque lecture.
 *
 * La donnée existait déjà — chaque écoute enregistre son code pays — mais
 * aucun écran ne la montrait. Nommer les pays plutôt qu'afficher « MG »
 * demande simplement au navigateur : `Intl.DisplayNames` connaît déjà la
 * table, inutile d'en embarquer une.
 */
export function CountriesPanel() {
  const [jours, setJours] = useState(30);
  const [pays, setPays] = useState<Pays[] | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let annule = false;
    setPays(null);
    fetch(`/api/admin/stats/countries?days=${jours}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (annule || !data) return;
        setPays(data.countries);
        setTotal(data.total);
      })
      .catch(() => !annule && setPays([]));
    return () => {
      annule = true;
    };
  }, [jours]);

  const nomDe = (code: string | null) => {
    if (!code) return "Origine inconnue";
    try {
      return new Intl.DisplayNames(["fr"], { type: "region" }).of(code) ?? code;
    } catch {
      return code;
    }
  };

  return (
    <AdminCard
      title="D'où viennent les écoutes"
      description="Pays relevé automatiquement à la lecture, à partir de la géolocalisation du réseau. Aucune adresse IP n'est conservée."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {FENETRES.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setJours(n)}
            aria-pressed={jours === n}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              jours === n ? "border-accent text-accent" : "border-border text-ink-muted hover:text-ink"
            }`}
          >
            {n} jours
          </button>
        ))}
      </div>

      {!pays ? (
        <AdminPanelSkeleton height="h-48" />
      ) : pays.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">
          Aucune écoute enregistrée sur cette période.
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-ink-muted">
            {formatCompactNumber(total)} écoute{total > 1 ? "s" : ""} sur {jours} jours
          </p>
          <ul className="space-y-3">
            {pays.map((ligne) => (
              <li key={ligne.code ?? "inconnu"}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <Globe2 size={14} className="shrink-0 text-ink-muted" />
                    <span className="truncate text-ink">{nomDe(ligne.code)}</span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-muted">
                    {formatCompactNumber(ligne.plays)} écoutes · {formatCompactNumber(ligne.listeners)} auditeurs ·{" "}
                    {ligne.share} %
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, ligne.share)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </AdminCard>
  );
}
