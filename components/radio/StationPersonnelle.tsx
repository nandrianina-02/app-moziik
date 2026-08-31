"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Play, RefreshCw, Sparkles } from "lucide-react";
import { usePlayer, type PlayableSong } from "@/context/PlayerProvider";
import { useToast } from "@/context/ToastProvider";
import { SafeImage } from "@/components/ui/SafeImage";
import { Skeleton } from "@/components/ui/Skeleton";
import { useUnivers } from "@/context/UniversProvider";
import { useMode } from "@/context/ModeProvider";
import { MODES_INFO } from "@/lib/modes";

/**
 * La station bâtie pour l'auditeur.
 *
 * Deux partis pris d'affichage.
 *
 * **La raison est visible avant la lecture.** Sous chaque titre figure ce
 * qui l'a fait entrer dans la file — « Vous écoutez Rakoto », « À
 * découvrir — Gospel ». Une recommandation qu'on ne peut pas
 * interroger se subit ; celle-ci se discute, et se corrige en écoutant
 * autre chose.
 *
 * **Le mode et l'univers viennent d'ici.** Ils sont choisis dans le
 * navigateur et transmis à la requête ; l'heure locale n'est envoyée
 * qu'en repli, pour la toute première visite d'un appareil qui n'a pas
 * encore de mode (voir lib/modes.ts et lib/univers.ts).
 */

type Motif = { songId: string; libelle: string };

type Reponse = {
  songs: PlayableSong[];
  motifs: Motif[];
  personnalisee: boolean;
  presentation?: { nom: string; intro: string; parIA: boolean };
};

/** Titres montrés avant lecture. Assez pour juger, pas de quoi remplir l'écran. */
const APERCU = 4;

export function StationPersonnelle() {
  const { playQueue } = usePlayer();
  const pushToast = useToast();
  // La station suit le mode et l'univers : en changer recompose la file,
  // sans quoi l'écran garderait la sélection du mode précédent.
  const { mode } = useMode();
  const { univers } = useUnivers();
  const [data, setData] = useState<Reponse | null>(null);
  const [erreur, setErreur] = useState(false);
  const [rafraichit, setRafraichit] = useState(false);

  const charger = useCallback(async () => {
    try {
      // Mode et univers sont transmis explicitement plutôt que laissés au
      // cookie : ils viennent d'être écrits, et la requête ne doit pas
      // dépendre de l'ordre dans lequel le navigateur les a posés.
      // L'heure reste en repli pour la toute première visite d'un appareil.
      const res = await fetch(
        `/api/station?heure=${new Date().getHours()}&mode=${mode}&univers=${univers}`
      );
      if (!res.ok) throw new Error();
      setData((await res.json()) as Reponse);
      setErreur(false);
    } catch {
      // Distingué de « pas encore arrivé » : sans ce drapeau, un échec
      // laisserait des squelettes tourner indéfiniment.
      setErreur(true);
    }
  }, [mode, univers]);

  useEffect(() => {
    charger();
  }, [charger]);

  async function relancer() {
    setRafraichit(true);
    await charger();
    setRafraichit(false);
  }

  function lancer() {
    if (!data?.songs.length) return;
    playQueue(data.songs, 0, {
      type: "radio",
      label: data.presentation?.nom ?? "Votre station",
      // Ce marqueur décide de la suite : /api/station plutôt qu'un filtre
      // de catalogue. Sans lui la station cesserait d'être personnalisée
      // au bout du premier tour.
      station: true,
    });
    pushToast("success", "Station lancée.");
  }

  if (erreur) return null;

  if (!data) {
    return (
      <section className="rounded-xl2 border border-border bg-surface p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-3 h-4 w-72" />
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {Array.from({ length: APERCU }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </section>
    );
  }

  const parId = new Map(data.motifs.map((m) => [m.songId, m.libelle]));
  const apercu = data.songs.slice(0, APERCU);


  return (
    <section className="rounded-xl2 border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-lg text-ink">
            <Sparkles size={18} className="shrink-0 text-accent" />
            {data.presentation?.nom ?? "Station Moziik"}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-ink-muted">
            {data.presentation?.intro ??
              "Ce que le public écoute en ce moment. Écoutez quelques titres et la station s'ajustera."}
          </p>
          {!data.personnalisee && (
            <p className="mt-1.5 text-xs text-ink-muted">
              Cette station n&apos;est pas encore personnalisée : elle le deviendra à mesure que vous
              écouterez.
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={relancer}
            disabled={rafraichit}
            aria-label="Composer une autre station"
            className="rounded-full border border-border p-2 text-ink-muted transition-colors hover:border-accent hover:text-ink disabled:opacity-50"
          >
            {rafraichit ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
          <button
            type="button"
            onClick={lancer}
            disabled={data.songs.length === 0}
            className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-base transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Play size={15} /> Lancer
          </button>
        </div>
      </div>

      {apercu.length > 0 && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {apercu.map((s, index) => (
            <li key={s._id}>
              <button
                type="button"
                onClick={() =>
                  playQueue(data.songs, index, {
                    type: "radio",
                    label: data.presentation?.nom ?? "Votre station",
                    station: true,
                  })
                }
                className="flex w-full items-center gap-3 rounded-xl border border-transparent p-2 text-left transition-colors hover:border-border hover:bg-base"
              >
                <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-base">
                  <SafeImage
                    src={s.coverUrl}
                    alt=""
                    width={44}
                    height={44}
                    className="h-full w-full object-cover"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{s.title}</span>
                  <span className="block truncate text-xs text-ink-muted">
                    {parId.get(s._id) ?? s.artist?.stageName ?? ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-ink-muted">
        {data.songs.length} titre{data.songs.length > 1 ? "s" : ""} pour commencer · {MODES_INFO[mode].label.toLowerCase()}
        {univers === "christian" ? " · répertoire évangélique" : ""} · elle se prolonge toute seule
      </p>
    </section>
  );
}
