"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LineChart,
  Loader2,
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  Play,
  Repeat,
  Music,
} from "lucide-react";
import { AdminPanelSkeleton } from "@/components/admin/AdminSkeleton";
import { useToast } from "@/context/ToastProvider";
import { readApiError } from "@/lib/readApiError";

/**
 * Le rapport d'exploitation.
 *
 * Deux principes d'affichage.
 *
 * **Les chiffres d'abord, l'interprétation ensuite.** Le texte de l'IA
 * est présenté comme une lecture, pas comme un résultat, et il n'écrit
 * aucun nombre (voir lib/ai/analyst.ts). Ce qui se décide se lit dans les
 * cartes chiffrées juste à côté.
 *
 * **Ce qui n'est pas mesurable est dit comme tel.** Une cohorte de trois
 * personnes n'affiche pas « 33 % », une prévision sans historique
 * n'affiche pas un nombre : dans les deux cas l'écran explique pourquoi.
 * Un tableau de bord qui remplit ses cases coûte que coûte fait décider
 * sur du vide.
 */

type Audience = {
  ecoutes: number;
  auditeurs: number;
  tauxCompletion: number;
  parAuditeur: number;
  partAnonyme: number;
};

type Mouvement = { id: string; nom: string; ecoutes: number; ecoutesAvant: number; progression: number };
type Genre = { genre: string; ecoutes: number; ecoutesAvant: number; progression: number };
type Cohorte = { semaine: string; arrivants: number; retours: (number | null)[]; suffisante: boolean };
type Anomalie = { type: string; constat: string; detail: string; intensite: number };
type Prevision = { historique: number[]; estimation: number; bas: number; haut: number; penteHebdo: number };
type Montant = { id: string; titre: string; artiste: string; trajectoire: number[] };

type Rapport = {
  fenetre: { libelle: string };
  audience: Audience;
  audiencePrecedente: Audience;
  comportement: {
    parHeure: number[];
    parAppareil: { appareil: string; ecoutes: number }[];
    tauxAbandon: number;
    auditeursDUnSeulTitre: number;
  };
  catalogue: {
    titresPublies: number;
    sortiesDeLaPeriode: number;
    jamaisEcoutes: number;
    artistes: number;
    nouveauxMembres: number;
  };
  artistes: { montent: Mouvement[]; decrochent: Mouvement[] };
  genres: Genre[];
  cohortes: Cohorte[];
  anomalies: Anomalie[];
  prevision: Prevision | null;
  titresQuiMontent: Montant[];
};

type Analyse = { lecture: string; aRegarder: string[]; parIA: boolean };

const nombre = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v));
const pourcent = (v: number) => `${Math.round(v * 100)} %`;
const pluriel = (v: number) => (v > 1 ? "s" : "");

/** Variation entre deux valeurs, ou `null` quand il n'y a rien à comparer. */
function variation(actuel: number, avant: number): number | null {
  if (avant <= 0) return null;
  return (actuel - avant) / avant;
}

function Ecart({ actuel, avant }: { actuel: number; avant: number }) {
  const v = variation(actuel, avant);
  if (v === null) return <span className="text-xs text-ink-muted">pas de comparaison</span>;
  const hausse = v >= 0;
  return (
    <span className={`flex items-center gap-1 text-xs ${hausse ? "text-success" : "text-warning"}`}>
      {hausse ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {hausse ? "+" : ""}
      {Math.round(v * 100)} % sur une semaine
    </span>
  );
}

export default function AdminAnalysesPage() {
  const pushToast = useToast();
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [analyse, setAnalyse] = useState<Analyse | null>(null);
  const [lecture, setLecture] = useState(false);

  const charger = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/insights");
      if (!res.ok) throw new Error(await readApiError(res, "Chargement impossible."));
      const data = await res.json();
      setRapport(data.rapport);
      setAnalyse(data.analyse);
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Chargement impossible.");
    }
  }, [pushToast]);

  useEffect(() => {
    charger();
  }, [charger]);

  async function demanderLecture() {
    setLecture(true);
    try {
      const res = await fetch("/api/admin/insights", { method: "POST" });
      if (!res.ok) throw new Error(await readApiError(res, "La lecture a échoué."));
      const data = await res.json();
      setRapport(data.rapport);
      setAnalyse(data.analyse);
      pushToast("success", data.analyse.parIA ? "Lecture ajoutée." : "L'IA n'était pas disponible.");
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "La lecture a échoué.");
    } finally {
      setLecture(false);
    }
  }

  if (!rapport) {
    return (
      <div className="space-y-4">
        <AdminPanelSkeleton height="h-28" />
        <AdminPanelSkeleton height="h-40" />
        <AdminPanelSkeleton height="h-96" />
      </div>
    );
  }

  const { audience, audiencePrecedente, comportement, catalogue, artistes, genres, cohortes, anomalies, prevision } =
    rapport;

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------ en-tête ---- */}
      <section className="rounded-xl2 border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-display text-lg text-ink">
              <LineChart size={18} className="text-accent" /> Analyses
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Semaine {rapport.fenetre.libelle}. Sept jours pleins, la journée en cours exclue — la même fenêtre
              que les sélections automatiques.
            </p>
          </div>
          <button
            type="button"
            onClick={demanderLecture}
            disabled={lecture}
            className="flex shrink-0 items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-base transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {lecture ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {analyse ? "Relire la semaine" : "Faire lire la semaine"}
          </button>
        </div>

        {analyse && (
          <div className="mt-4 rounded-xl border border-border bg-base p-4">
            <p className="text-sm leading-relaxed text-ink">{analyse.lecture}</p>
            {analyse.aRegarder.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {analyse.aRegarder.map((point) => (
                  <li key={point} className="flex gap-2 text-sm text-ink-muted">
                    <span aria-hidden className="text-accent">
                      ·
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-ink-muted">
              {analyse.parIA
                ? "Lecture rédigée par l'IA à partir des mesures ci-dessous. Elle n'écrit aucun chiffre — ceux qui comptent sont dans les cartes."
                : "L'IA n'était pas disponible : les mesures restent complètes."}
            </p>
          </div>
        )}
      </section>

      {/* ----------------------------------------------------- audience ---- */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Écoutes", valeur: nombre(audience.ecoutes), avant: audiencePrecedente.ecoutes, actuel: audience.ecoutes, icone: Play },
          { label: "Auditeurs", valeur: nombre(audience.auditeurs), avant: audiencePrecedente.auditeurs, actuel: audience.auditeurs, icone: Users },
          { label: "Écoutes menées au bout", valeur: pourcent(audience.tauxCompletion), avant: audiencePrecedente.tauxCompletion, actuel: audience.tauxCompletion, icone: Repeat },
          { label: "Coupées très tôt", valeur: pourcent(comportement.tauxAbandon), avant: 0, actuel: 0, icone: TrendingDown },
        ].map(({ label, valeur, avant, actuel, icone: Icone }) => (
          <div key={label} className="rounded-xl2 border border-border bg-surface p-4">
            <p className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Icone size={13} /> {label}
            </p>
            <p className="mt-1 font-display text-2xl text-ink">{valeur}</p>
            {avant > 0 && (
              <div className="mt-1">
                <Ecart actuel={actuel} avant={avant} />
              </div>
            )}
          </div>
        ))}
      </section>

      {/* --------------------------------------------------- prévision ---- */}
      <section className="rounded-xl2 border border-border bg-surface p-5">
        <h3 className="text-sm uppercase tracking-wide text-ink-muted">Semaine à venir</h3>
        {prevision ? (
          <>
            <p className="mt-3 font-display text-2xl text-ink">
              entre {nombre(prevision.bas)} et {nombre(prevision.haut)} écoutes
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              Prolongement de la tendance des {prevision.historique.length} dernières semaines
              {prevision.penteHebdo !== 0
                ? `, orientée ${prevision.penteHebdo > 0 ? "à la hausse" : "à la baisse"}`
                : ", à plat"}
              .
            </p>
            <p className="mt-2 text-xs text-ink-muted">
              Ce n&apos;est pas une prédiction : c&apos;est ce que donnerait la droite si rien ne changeait. Une
              sortie attendue, une panne ou une campagne la rendent caduque.
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">
            Pas assez d&apos;historique pour dégager une tendance — il en faut au moins quatre semaines pleines.
            Aucun chiffre n&apos;est avancé plutôt qu&apos;un chiffre qui ne voudrait rien dire.
          </p>
        )}
      </section>

      {/* ---------------------------------------------------- anomalies ---- */}
      {anomalies.length > 0 && (
        <section className="rounded-xl2 border border-warning/40 bg-surface p-5">
          <h3 className="flex items-center gap-2 text-sm uppercase tracking-wide text-warning">
            <AlertTriangle size={15} /> {anomalies.length} point{pluriel(anomalies.length)} d&apos;attention
          </h3>
          <ul className="mt-3 space-y-3">
            {anomalies.map((a) => (
              <li key={a.constat} className="rounded-xl border border-border bg-base p-3">
                <p className="text-sm text-ink">{a.constat}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{a.detail}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-muted">
            Ce sont des constats, pas des verdicts : rien n&apos;a été masqué ni suspendu.
          </p>
        </section>
      )}

      {/* ---------------------------------------------------- rétention ---- */}
      <section className="rounded-xl2 border border-border bg-surface p-5">
        <h3 className="text-sm uppercase tracking-wide text-ink-muted">Rétention par cohortes</h3>
        <p className="mt-1 text-sm text-ink-muted">
          Sur les auditeurs dont la première écoute tombe cette semaine-là, la part qui revient les semaines
          suivantes.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[26rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-muted">
                <th className="pb-2 font-medium">Arrivés la semaine du</th>
                <th className="pb-2 font-medium">Nombre</th>
                <th className="pb-2 font-medium">+1 sem.</th>
                <th className="pb-2 font-medium">+2 sem.</th>
                <th className="pb-2 font-medium">+3 sem.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cohortes.map((c) => (
                <tr key={c.semaine}>
                  <td className="py-2 text-ink">{c.semaine}</td>
                  <td className="py-2 text-ink-muted">{c.arrivants}</td>
                  {c.retours.map((r, i) => (
                    <td key={i} className="py-2 text-ink-muted">
                      {r === null ? (
                        <span className="text-xs">à venir</span>
                      ) : !c.suffisante ? (
                        <span className="text-xs">trop peu</span>
                      ) : (
                        pourcent(r)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-muted">
          « Trop peu » signale une cohorte de moins de cinq personnes : un pourcentage y désignerait une seule
          personne.
        </p>
      </section>

      {/* ------------------------------------------------------ artistes ---- */}
      <section className="grid gap-4 lg:grid-cols-2">
        {[
          { titre: "Artistes en progression", lignes: artistes.montent, hausse: true },
          { titre: "Artistes en recul", lignes: artistes.decrochent, hausse: false },
        ].map(({ titre, lignes, hausse }) => (
          <div key={titre} className="rounded-xl2 border border-border bg-surface p-5">
            <h3 className="text-sm uppercase tracking-wide text-ink-muted">{titre}</h3>
            {lignes.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">
                Rien de net cette semaine — il faut un socle d&apos;écoutes suffisant pour qu&apos;un mouvement
                veuille dire quelque chose.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {lignes.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-ink">{a.nom}</span>
                    <span className={`shrink-0 text-xs ${hausse ? "text-success" : "text-warning"}`}>
                      {nombre(a.ecoutesAvant)} → {nombre(a.ecoutes)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>

      {/* -------------------------------------------- genres & catalogue ---- */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl2 border border-border bg-surface p-5">
          <h3 className="text-sm uppercase tracking-wide text-ink-muted">Genres les plus écoutés</h3>
          {genres.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">Aucune écoute sur la période.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {genres.map((g) => (
                <li key={g.genre} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-ink">{g.genre}</span>
                  <span className="shrink-0 text-xs text-ink-muted">
                    {nombre(g.ecoutes)} écoute{pluriel(g.ecoutes)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl2 border border-border bg-surface p-5">
          <h3 className="flex items-center gap-2 text-sm uppercase tracking-wide text-ink-muted">
            <Music size={15} /> Catalogue
          </h3>
          <dl className="mt-3 space-y-2 text-sm">
            {[
              ["Titres publiés", nombre(catalogue.titresPublies)],
              ["Sortis cette semaine", nombre(catalogue.sortiesDeLaPeriode)],
              ["Jamais écoutés", nombre(catalogue.jamaisEcoutes)],
              ["Artistes", nombre(catalogue.artistes)],
              ["Nouveaux membres", nombre(catalogue.nouveauxMembres)],
            ].map(([label, valeur]) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <dt className="text-ink-muted">{label}</dt>
                <dd className="text-ink">{valeur}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* --------------------------------------------- titres qui montent ---- */}
      {rapport.titresQuiMontent.length > 0 && (
        <section className="rounded-xl2 border border-border bg-surface p-5">
          <h3 className="text-sm uppercase tracking-wide text-ink-muted">En progression continue</h3>
          <p className="mt-1 text-sm text-ink-muted">
            Titres dont l&apos;écoute monte trois semaines de suite. Une trajectoire, pas une promesse.
          </p>
          <ul className="mt-3 space-y-2">
            {rapport.titresQuiMontent.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-ink">
                  {t.titre} <span className="text-ink-muted">— {t.artiste}</span>
                </span>
                <span className="shrink-0 text-xs text-ink-muted">{t.trajectoire.join(" → ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
