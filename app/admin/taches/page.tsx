"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Loader2, Play, RefreshCw } from "lucide-react";
import { AdminPanelSkeleton } from "@/components/admin/AdminSkeleton";
import { useToast } from "@/context/ToastProvider";
import { readApiError } from "@/lib/readApiError";
import { UNIVERS, UNIVERS_INFO } from "@/lib/univers";
import type { TachePlanifiee } from "@/lib/tachesPlanifiees";

/**
 * Lancer les tâches planifiées à la main.
 *
 * Elles tournent d'elles-mêmes chez un ordonnanceur externe. Cet écran ne
 * les planifie pas : il les déclenche, pour rattraper une nuit manquée ou
 * vérifier qu'une tâche fait bien ce qu'on croit — sans avoir à retrouver
 * `CRON_SECRET` et fabriquer une requête à la main.
 */

type Resultat = {
  ok: boolean;
  statut: number;
  dureeMs: number;
  resultat: unknown;
  /** Horodatage local du lancement, pour situer le résultat affiché. */
  a: number;
};

function dureeLisible(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const secondes = ms / 1000;
  if (secondes < 60) return `${secondes.toFixed(1)} s`;
  return `${Math.floor(secondes / 60)} min ${Math.round(secondes % 60)} s`;
}

export default function AdminTachesPage() {
  const pushToast = useToast();

  const [taches, setTaches] = useState<TachePlanifiee[] | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [resultats, setResultats] = useState<Record<string, Resultat>>({});
  const [universChoisi, setUniversChoisi] = useState<string>("");

  useEffect(() => {
    fetch("/api/admin/crons")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setTaches(data?.taches ?? []))
      .catch(() => setTaches([]));
  }, []);

  async function lancer(tache: TachePlanifiee) {
    setEnCours(tache.id);
    try {
      const res = await fetch("/api/admin/crons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tache: tache.id,
          ...(tache.parUnivers && universChoisi ? { univers: universChoisi } : {}),
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Le lancement a échoué."));
      const data = await res.json();

      setResultats((prev) => ({ ...prev, [tache.id]: { ...data, a: Date.now() } }));
      pushToast(
        data.ok ? "success" : "error",
        data.ok ? `${tache.titre} : terminé.` : `${tache.titre} : la tâche a répondu ${data.statut}.`
      );
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Le lancement a échoué.");
    } finally {
      setEnCours(null);
    }
  }

  if (!taches) return <AdminPanelSkeleton height="h-96" />;

  return (
    <div className="space-y-4">
      <p className="rounded-xl2 border border-border bg-surface px-4 py-3 text-sm text-ink-muted">
        Ces tâches sont déclenchées par un ordonnanceur externe, aux horaires rappelés ci-dessous.
        Les lancer ici exécute exactement le même traitement — utile pour rattraper une nuit manquée.
        L&apos;appel attend la fin : une tâche longue peut prendre plusieurs minutes.
      </p>

      {taches.map((tache) => {
        const resultat = resultats[tache.id];
        const occupe = enCours === tache.id;

        return (
          <section key={tache.id} className="rounded-xl2 border border-border bg-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold">{tache.titre}</h2>
                <p className="mt-1 text-sm text-ink-muted">{tache.resume}</p>

                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted">
                  <span className="flex items-center gap-1.5">
                    <Clock size={12} /> {tache.horaire}
                  </span>
                  <span className="font-mono text-[11px]">/api/cron/{tache.id}</span>
                  {!tache.rejouable && (
                    <span className="flex items-center gap-1.5 text-warning">
                      <AlertTriangle size={12} /> Un seul passage à la fois
                    </span>
                  )}
                </div>

                <p className="mt-2 text-xs text-ink-muted">{tache.enjeu}</p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                {tache.parUnivers && (
                  <label className="flex items-center gap-2 text-xs text-ink-muted">
                    <span className="sr-only">Univers à analyser</span>
                    <select
                      value={universChoisi}
                      onChange={(e) => setUniversChoisi(e.target.value)}
                      className="rounded-xl border border-border bg-base px-3 py-2 text-xs text-ink outline-none focus:border-accent"
                    >
                      <option value="">Les deux univers</option>
                      {UNIVERS.map((u) => (
                        <option key={u} value={u}>
                          {UNIVERS_INFO[u].label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <button
                  type="button"
                  onClick={() => lancer(tache)}
                  disabled={enCours !== null}
                  className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
                >
                  {occupe ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                  {occupe ? "En cours..." : "Lancer"}
                </button>
              </div>
            </div>

            {resultat && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="flex flex-wrap items-center gap-2 text-xs">
                  {resultat.ok ? (
                    <CheckCircle2 size={14} className="text-verified" />
                  ) : (
                    <AlertTriangle size={14} className="text-warning" />
                  )}
                  <span className={resultat.ok ? "text-verified" : "text-warning"}>
                    HTTP {resultat.statut}
                  </span>
                  <span className="text-ink-muted">en {dureeLisible(resultat.dureeMs)}</span>
                  <span className="text-ink-muted">
                    — {new Date(resultat.a).toLocaleTimeString("fr-FR")}
                  </span>
                </p>

                {/* La réponse brute de la tâche : c'est là que se lisent les
                    compteurs (titres publiés, écoutes traitées, reste à
                    faire) sans avoir à ouvrir les journaux de l'hébergeur. */}
                <pre className="selectionnable mt-2 max-h-48 overflow-auto rounded-xl bg-base p-3 text-[11px] leading-relaxed text-ink-muted">
                  {JSON.stringify(resultat.resultat, null, 2)}
                </pre>
              </div>
            )}
          </section>
        );
      })}

      <p className="flex items-start gap-2.5 rounded-xl2 border border-border bg-base p-4 text-xs text-ink-muted">
        <RefreshCw size={14} className="mt-0.5 shrink-0" />
        Rien n&apos;est conservé d&apos;un lancement à l&apos;autre : le résultat affiché est celui
        de la tâche que vous venez de lancer. L&apos;historique complet reste dans les journaux de
        l&apos;hébergeur et chez l&apos;ordonnanceur.
      </p>
    </div>
  );
}
