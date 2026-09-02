"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Gauge, Loader2, Play, Square } from "lucide-react";
import { AdminPanelSkeleton } from "@/components/admin/AdminSkeleton";
import { useToast } from "@/context/ToastProvider";
import { readApiError } from "@/lib/readApiError";
import { estimerTempo } from "@/lib/bpm";

/**
 * Analyse du tempo sur le catalogue déjà en ligne.
 *
 * Huit des douze modes d'écoute s'appuient sur le tempo (lib/modes.ts) :
 * sans lui, « Sport », « Sommeil » ou « Étude » n'ont rien à proposer. Les
 * titres publiés avant cette analyse n'en ont aucun.
 *
 * Le travail se fait dans cet onglet, pas sur le serveur : le navigateur
 * sait décoder l'audio nativement, et faire transiter tout le catalogue
 * par une fonction sans état coûterait la bande passante pour un résultat
 * identique. La contrepartie est qu'il faut laisser la page ouverte.
 */

type Titre = { _id: string; title: string; artistName: string };

type Resultat = {
  titre: Titre;
  etat: "analyse" | "ecrit" | "ignore" | "erreur";
  bpm?: number;
  /** Pourquoi ce titre n'a pas reçu de tempo. */
  raison?: string;
};

/** Deux à la fois : chaque analyse télécharge un fichier et décode l'audio. */
const SIMULTANEES = 2;

export default function AdminBpmPage() {
  const pushToast = useToast();

  const [restants, setRestants] = useState<number | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [resultats, setResultats] = useState<Resultat[]>([]);
  const arret = useRef(false);

  const compterRestants = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/bpm?limite=1");
      if (!res.ok) throw new Error(await readApiError(res, "Chargement impossible."));
      const data = await res.json();
      setRestants(data.restants);
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Chargement impossible.");
    } finally {
      setChargement(false);
    }
  }, [pushToast]);

  useEffect(() => {
    compterRestants();
  }, [compterRestants]);

  /** Analyse un titre et enregistre le résultat, ou dit pourquoi il n'y en a pas. */
  async function traiter(titre: Titre): Promise<Resultat> {
    try {
      // Qualité basse : le tempo ne dépend pas du débit, et un fichier
      // quatre fois plus léger se télécharge quatre fois plus vite.
      const reponse = await fetch(`/api/stream/${titre._id}?q=low`);
      if (!reponse.ok) return { titre, etat: "erreur", raison: `Fichier inaccessible (${reponse.status})` };

      const estimation = await estimerTempo(await reponse.blob());

      if (!estimation) {
        return { titre, etat: "ignore", raison: "Aucun tempo régulier détecté" };
      }
      if (estimation.ambigu) {
        // Le double et la moitié se valaient : écrire l'un des deux
        // rangerait peut-être une berceuse dans « Sport ». On s'abstient.
        return {
          titre,
          etat: "ignore",
          bpm: estimation.bpm,
          raison: `Ambigu — ${estimation.bpm} ou ${estimation.bpm * 2} BPM`,
        };
      }

      const maj = await fetch(`/api/songs/${titre._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bpm: estimation.bpm, bpmSource: "analyse" }),
      });
      if (!maj.ok) return { titre, etat: "erreur", raison: await readApiError(maj, "Enregistrement refusé.") };

      return { titre, etat: "ecrit", bpm: estimation.bpm };
    } catch (err) {
      return { titre, etat: "erreur", raison: err instanceof Error ? err.message : "Échec de l'analyse" };
    }
  }

  async function lancer() {
    setEnCours(true);
    arret.current = false;
    setResultats([]);

    try {
      const res = await fetch("/api/admin/bpm");
      if (!res.ok) throw new Error(await readApiError(res, "Chargement impossible."));
      const { titres } = (await res.json()) as { titres: Titre[] };

      if (titres.length === 0) {
        pushToast("info", "Aucun titre à analyser.");
        return;
      }

      setResultats(titres.map((titre) => ({ titre, etat: "analyse" as const })));

      let curseur = 0;
      const ouvriers = Array.from({ length: Math.min(SIMULTANEES, titres.length) }, async () => {
        while (curseur < titres.length && !arret.current) {
          const titre = titres[curseur++];
          const resultat = await traiter(titre);
          setResultats((prev) => prev.map((r) => (r.titre._id === titre._id ? resultat : r)));
        }
      });
      await Promise.all(ouvriers);

      await compterRestants();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Analyse impossible.");
    } finally {
      setEnCours(false);
    }
  }

  const ecrits = resultats.filter((r) => r.etat === "ecrit").length;
  const ignores = resultats.filter((r) => r.etat === "ignore").length;
  const erreurs = resultats.filter((r) => r.etat === "erreur").length;

  if (chargement) return <AdminPanelSkeleton height="h-64" />;

  return (
    <div className="space-y-5">
      <section className="rounded-xl2 border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-2xl font-display">{restants ?? "—"}</p>
            <p className="mt-1 text-sm text-ink-muted">
              titre(s) sans tempo. Huit des douze modes d&apos;écoute en dépendent : sans lui,
              « Sport », « Sommeil » et « Étude » n&apos;ont rien à proposer.
            </p>
          </div>

          {enCours ? (
            <button
              type="button"
              onClick={() => {
                arret.current = true;
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:border-danger hover:text-danger"
            >
              <Square size={15} /> Arrêter
            </button>
          ) : (
            <button
              type="button"
              onClick={lancer}
              disabled={restants === 0}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              <Play size={15} /> Analyser une fournée
            </button>
          )}
        </div>

        <p className="mt-4 rounded-xl border border-border bg-base p-3.5 text-xs text-ink-muted">
          L&apos;analyse se fait dans cet onglet : chaque titre est téléchargé en qualité réduite,
          décodé, puis mesuré. Laissez la page ouverte. Une fournée traite vingt-cinq titres ;
          relancez jusqu&apos;à épuisement.
        </p>
      </section>

      {resultats.length > 0 && (
        <section className="rounded-xl2 border border-border bg-surface">
          <div className="flex flex-wrap items-center gap-4 border-b border-border px-5 py-3 text-xs">
            <span className="flex items-center gap-1.5 text-verified">
              <Check size={13} /> {ecrits} enregistré(s)
            </span>
            <span className="flex items-center gap-1.5 text-warning">
              <AlertTriangle size={13} /> {ignores} sans tempo lisible
            </span>
            {erreurs > 0 && <span className="text-danger">{erreurs} en erreur</span>}
          </div>

          <ul className="divide-y divide-border">
            {resultats.map((r) => (
              <li key={r.titre._id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="w-5 shrink-0">
                  {r.etat === "analyse" && <Loader2 size={14} className="animate-spin text-ink-muted" />}
                  {r.etat === "ecrit" && <Check size={14} className="text-verified" />}
                  {r.etat === "ignore" && <AlertTriangle size={14} className="text-warning" />}
                  {r.etat === "erreur" && <AlertTriangle size={14} className="text-danger" />}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.titre.title}</span>
                  <span className="block truncate text-xs text-ink-muted">{r.titre.artistName}</span>
                </span>

                <span className="shrink-0 text-right text-xs">
                  {r.etat === "ecrit" && (
                    <span className="flex items-center gap-1 font-medium text-verified">
                      <Gauge size={12} /> {r.bpm} BPM
                    </span>
                  )}
                  {(r.etat === "ignore" || r.etat === "erreur") && (
                    <span className="text-ink-muted">{r.raison}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
