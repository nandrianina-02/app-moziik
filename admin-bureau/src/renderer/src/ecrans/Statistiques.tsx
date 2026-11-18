import { useEffect, useMemo, useState } from "react";
import { Crown, Disc3, Globe2, Headphones, ListMusic, Mic2, Music, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { api, ErreurApi } from "../api";
import { Carte, EnTete, Erreur, formatCompact, formatNombre , BarreCollante } from "../composants";
import { CourbeAire } from "../graphiques";
import { useCoquille } from "../App";
import clsx from "../clsx";

interface Ecoutes {
  days: number;
  total: number;
  previousTotal: number;
  trendPct: number | null;
  series: { date: string; plays: number }[];
}

interface Pays {
  days: number;
  total: number;
  countries: { code: string | null; plays: number; listeners: number; share: number }[];
}

interface StatsCompletes {
  signupsEvolution?: number[];
  contentBreakdown?: { label: string; count: number }[];
}

const PERIODES = [7, 30, 90, 365] as const;
const nomsPays = new Intl.DisplayNames(["fr"], { type: "region" });
const nomPays = (code: string | null) => {
  if (!code) return "Inconnu";
  try {
    return nomsPays.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
};

/**
 * Les statistiques détaillées : écoutes dans le temps et par pays, sur une
 * période au choix, puis inscriptions et contenu. Les écoutes comptent
 * toutes les lectures, achevées ou non, dans les deux univers.
 */
export function Statistiques() {
  const { stats } = useCoquille();
  const [jours, setJours] = useState<(typeof PERIODES)[number]>(30);
  const [ecoutes, setEcoutes] = useState<Ecoutes | null>(null);
  const [pays, setPays] = useState<Pays | null>(null);
  const [complet, setComplet] = useState<StatsCompletes | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [absente, setAbsente] = useState(false);

  useEffect(() => {
    setEcoutes(null);
    setPays(null);
    setErreur(null);
    api<Ecoutes>(`/api/admin/stats/ecoutes?days=${jours}`)
      .then((r) => setEcoutes({ ...r, series: r.series ?? [] }))
      .catch((e) => (e instanceof ErreurApi && e.statut === 404 ? setAbsente(true) : setErreur(e instanceof Error ? e.message : "Données indisponibles.")));
    api<Pays>(`/api/admin/stats/countries?days=${jours}`)
      .then((r) => setPays({ ...r, countries: r.countries ?? [] }))
      .catch((e: Error) => setErreur(e.message));
  }, [jours]);

  // La courbe des inscriptions et la répartition du contenu ne sont pas
  // dans le résumé gardé par la coquille : une lecture de plus, une fois.
  useEffect(() => {
    api<StatsCompletes>("/api/admin/stats")
      .then(setComplet)
      .catch(() => setComplet({}));
  }, []);

  // Le site rend le total cumulé jour après jour ; sur une base de plus
  // d'un millier de comptes, la courbe cumulée paraît plate. La différence
  // d'un jour à l'autre donne les nouveaux membres, plus parlants (le
  // premier jour, sans veille connue, est écarté).
  const inscriptions = useMemo(() => {
    const serie = complet?.signupsEvolution ?? [];
    return serie.slice(1).map((n, i) => ({ date: new Date(Date.now() - (serie.length - 2 - i) * 864e5).toISOString().slice(0, 10), plays: Math.max(0, n - serie[i]) }));
  }, [complet]);

  const totalEcoutes = ecoutes?.total ?? pays?.total ?? null;
  const moyenne = ecoutes && ecoutes.series.length ? ecoutes.total / ecoutes.series.length : null;
  const paysConnus = pays?.countries.filter((c) => c.code).length ?? null;
  const maxPart = Math.max(1, ...(pays?.countries.map((c) => c.share) ?? [1]));
  const contenu = complet?.contentBreakdown ?? [];
  const icones: Record<string, LucideIcon> = { Musiques: Music, Artistes: Mic2, Albums: Disc3, Playlists: ListMusic };

  return (
    <>
      <EnTete titre="Statistiques" texte="Les écoutes de toute la plateforme, achevées ou non." />
      {/* La période commande toute la page : elle reste visible pendant le défilement. */}
      <BarreCollante className="animate-monter decale-1">
        <span className="text-[12.5px] font-medium text-texte-2">Période</span>
        <div className="flex rounded-lg border border-filet bg-surface p-0.5">
          {PERIODES.map((p) => (
            <button
              key={p}
              onClick={() => setJours(p)}
              className={clsx("rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors", jours === p ? "bg-accent text-sur-accent" : "text-texte-2 hover:text-texte")}
            >
              {p === 365 ? "12 mois" : `${p} jours`}
            </button>
          ))}
        </div>
      </BarreCollante>
      <Erreur message={erreur} />

      <div className="mb-5 grid grid-cols-2 gap-5 xl:grid-cols-4">
        <Resume className="decale-1" icone={Headphones} libelle="Écoutes" valeur={totalEcoutes === null ? null : formatNombre(totalEcoutes)} tendance={ecoutes?.trendPct ?? undefined} />
        <Resume className="decale-2" icone={TrendingUp} libelle="Moyenne par jour" valeur={moyenne === null ? (absente ? "—" : null) : formatNombre(Math.round(moyenne))} />
        <Resume className="decale-3" icone={Globe2} libelle="Pays d'écoute" valeur={paysConnus === null ? null : formatNombre(paysConnus)} />
        <Resume className="decale-4" icone={Crown} libelle="Abonnements actifs" valeur={stats ? formatNombre(stats.activeSubscriptions) : null} tendance={stats?.trends?.subscriptions} contexte="ce mois" />
      </div>

      <div className="grid grid-cols-12 gap-5">
        <Carte titre="Écoutes par jour" className="animate-monter decale-2 col-span-12">
          {absente ? (
            <div className="grid h-[300px] place-items-center rounded-xl border border-dashed border-filet text-[13px] text-texte-3">La courbe jour par jour arrive avec la prochaine mise à jour du site.</div>
          ) : ecoutes ? (
            <CourbeAire serie={ecoutes.series} hauteur={300} />
          ) : (
            <div className="h-[300px] animate-pulse rounded-xl bg-surface-2/60" />
          )}
        </Carte>

        <Carte titre="Écoutes par pays" className="animate-monter decale-3 col-span-12 xl:col-span-7">
          {!pays ? (
            <div className="h-[280px] animate-pulse rounded-xl bg-surface-2/60" />
          ) : pays.countries.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-texte-3">Aucune écoute sur la période.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="text-[11px] tracking-wide text-texte-3 uppercase">
                <tr>
                  <th className="pb-2 text-left font-semibold">Pays</th>
                  <th className="w-[40%] pb-2 text-left font-semibold">Part</th>
                  <th className="pb-2 text-right font-semibold">Écoutes</th>
                  <th className="pb-2 text-right font-semibold">Auditeurs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-filet">
                {pays.countries.map((c) => (
                  <tr key={c.code ?? "inconnu"}>
                    <td className="py-2.5 pr-3">
                      <span className="mr-2 inline-block w-7 rounded bg-surface-2 py-0.5 text-center text-[10.5px] font-bold text-texte-2">{c.code ?? "?"}</span>
                      <span className={c.code ? "font-medium" : "text-texte-3"}>{nomPays(c.code)}</span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-1.5 flex-1 rounded-full bg-surface-2">
                          <div className="h-1.5 rounded-full bg-accent" style={{ width: `${(c.share / maxPart) * 100}%` }} />
                        </div>
                        <span className="w-12 text-right text-[12px] text-texte-2 tabular-nums">{c.share.toLocaleString("fr-FR")} %</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">{formatNombre(c.plays)}</td>
                    <td className="py-2.5 text-right text-texte-2 tabular-nums">{formatNombre(c.listeners)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-[12px] text-texte-3">Auditeurs : comptes connectés distincts. Les écoutes anonymes comptent dans le total mais pas ici.</p>
        </Carte>

        <Carte titre="Contenu du catalogue" className="animate-monter decale-4 col-span-12 xl:col-span-5">
          {!complet ? (
            <div className="h-[280px] animate-pulse rounded-xl bg-surface-2/60" />
          ) : (
            <ul className="space-y-1">
              {contenu.map((c) => {
                const Icone = icones[c.label] ?? Music;
                return (
                  <li key={c.label} className="flex items-center gap-3.5 rounded-xl px-2 py-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2 text-accent">
                      <Icone size={18} />
                    </span>
                    <span className="flex-1 text-[13.5px] text-texte-2">{c.label}</span>
                    <span className="font-titre text-[20px] font-semibold tabular-nums">{formatCompact(c.count)}</span>
                  </li>
                );
              })}
              {stats && (
                <li className="flex items-center gap-3.5 rounded-xl px-2 py-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2 text-accent">
                    <Music size={18} />
                  </span>
                  <span className="flex-1 text-[13.5px] text-texte-2">Titres en attente de validation</span>
                  <span className="font-titre text-[20px] font-semibold tabular-nums">{formatNombre(stats.pendingSongs)}</span>
                </li>
              )}
            </ul>
          )}
        </Carte>

        <Carte titre="Nouveaux membres par jour" className="animate-monter decale-5 col-span-12">
          {!complet ? (
            <div className="h-[240px] animate-pulse rounded-xl bg-surface-2/60" />
          ) : inscriptions.length > 1 ? (
            <CourbeAire serie={inscriptions} hauteur={240} unite="nouveaux membres" />
          ) : (
            <p className="py-10 text-center text-[13px] text-texte-3">Pas de données d'inscription.</p>
          )}
        </Carte>
      </div>
    </>
  );
}

function Resume({ icone: Icone, libelle, valeur, tendance, contexte = "vs période précédente", className }: { icone: LucideIcon; libelle: string; valeur: string | null; tendance?: number; contexte?: string; className?: string }) {
  return (
    <div className={clsx("animate-monter rounded-2xl border border-filet bg-surface p-5", className)}>
      <div className="flex items-center justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/12 text-accent">
          <Icone size={19} />
        </span>
        {typeof tendance === "number" && (
          <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums", tendance >= 0 ? "bg-succes/12 text-succes" : "bg-danger/12 text-danger")} title={contexte}>
            {tendance >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {tendance > 0 ? "+" : ""}
            {tendance.toLocaleString("fr-FR")} %
          </span>
        )}
      </div>
      <div className="mt-4 font-titre text-[26px] leading-none font-semibold tabular-nums">{valeur ?? <span className="inline-block h-7 w-20 animate-pulse rounded-md bg-surface-2" />}</div>
      <div className="mt-1.5 text-[13px] text-texte-2">{libelle}</div>
    </div>
  );
}
