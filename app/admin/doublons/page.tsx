"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Copy, Loader2, Pause, Pencil, Play, Split } from "lucide-react";
import { AdminCardsSkeleton } from "@/components/admin/AdminSkeleton";
import { SafeImage } from "@/components/ui/SafeImage";
import { useToast } from "@/context/ToastProvider";

type Titre = {
  _id: string;
  title: string;
  coverUrl?: string;
  duration?: number;
  playsCount?: number;
  likesCount?: number;
  status?: string;
  createdAt?: string;
  album?: { title?: string };
  artist?: { stageName?: string };
};
type Paire = { _id: string; a: Titre | null; b: Titre | null; similarite?: number; raison: "empreinte" | "titre" };

function duree(s?: number) {
  if (!s) return "–";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.round(s % 60)).padStart(2, "0")}`;
}

function date(iso?: string) {
  return iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "–";
}

/**
 * Les doublons proposés par l'analyse : chaque paire se réécoute côte à
 * côte, puis on garde l'un des deux, ou on la classe comme deux morceaux
 * différents. Le titre écarté n'est pas supprimé : il quitte le catalogue
 * public et ses écoutes, playlists et « j'aime » passent au titre gardé.
 */
export default function AdminDoublonsPage() {
  const pushToast = useToast();
  const [page, setPage] = useState(1);
  const [paires, setPaires] = useState<Paire[] | null>(null);
  const [compteurs, setCompteurs] = useState({ aTraiter: 0, traitees: 0 });
  const [suite, setSuite] = useState(false);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [ecoute, setEcoute] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  const charger = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/doublons?page=${page}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPaires(data.paires);
      setCompteurs(data.compteurs);
      setSuite(data.suite);
    } catch {
      pushToast("error", "Impossible de charger les doublons.");
      setPaires([]);
    }
  }, [page, pushToast]);

  useEffect(() => {
    charger();
  }, [charger]);

  useEffect(() => () => audio.current?.pause(), []);

  function ecouter(id: string) {
    if (ecoute === id) {
      audio.current?.pause();
      setEcoute(null);
      return;
    }
    audio.current?.pause();
    const a = new Audio(`/api/stream/${id}?q=low`);
    // Le même passage des deux titres, pour les comparer à l'oreille.
    a.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(a.duration)) a.currentTime = a.duration * 0.35;
    });
    a.addEventListener("ended", () => setEcoute(null));
    a.play().catch(() => pushToast("error", "Lecture impossible."));
    audio.current = a;
    setEcoute(id);
  }

  async function trancher(paire: Paire, corps: Record<string, unknown>, message: string) {
    setEnCours(paire._id);
    try {
      const res = await fetch("/api/admin/doublons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: paire._id, ...corps }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Échec.");
      audio.current?.pause();
      setEcoute(null);
      pushToast("success", message);
      await charger();
    } catch (e) {
      pushToast("error", e instanceof Error ? e.message : "Échec.");
    } finally {
      setEnCours(null);
    }
  }

  // Une fonction plutôt qu'un composant : déclaré ici, il serait remonté à chaque rendu.
  function carte(paire: Paire, t: Titre | null) {
    if (!t) return <div className="p-4 text-sm text-ink-muted">Titre supprimé.</div>;
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => ecouter(t._id)}
            aria-label={ecoute === t._id ? "Arrêter l'extrait" : "Écouter un extrait"}
            className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg"
          >
            <SafeImage src={t.coverUrl} alt="" width={56} height={56} className="h-14 w-14 object-cover" />
            <span className="absolute inset-0 grid place-items-center bg-black/40 text-white">
              {ecoute === t._id ? <Pause size={16} /> : <Play size={16} />}
            </span>
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{t.title}</p>
            <p className="truncate text-xs text-ink-muted">{t.artist?.stageName ?? "Artiste supprimé"}</p>
            {t.album?.title && <p className="truncate text-xs text-ink-muted">Album : {t.album.title}</p>}
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <dt className="text-ink-muted">Durée</dt>
            <dd className="tabular-nums text-ink">{duree(t.duration)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Écoutes</dt>
            <dd className="tabular-nums text-ink">{t.playsCount ?? 0}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Ajouté le</dt>
            <dd className="text-ink">{date(t.createdAt)}</dd>
          </div>
        </dl>
        <div className="mt-auto flex items-center gap-2">
          <button
            type="button"
            disabled={enCours !== null}
            onClick={() => trancher(paire, { garder: t._id }, `« ${t.title} » gardé, l'autre écarté.`)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
          >
            <Check size={13} />
            Garder celui-ci
          </button>
          <Link
            href={`/son/${t._id}/modifier`}
            target="_blank"
            title="Corriger le titre ou l'artiste"
            aria-label={`Modifier « ${t.title} »`}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink-muted transition-colors hover:border-accent hover:text-ink"
          >
            <Pencil size={14} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-ink-muted animate-fade-in-up">
        <span className="tabular-nums text-ink">{compteurs.aTraiter}</span> paire{compteurs.aTraiter > 1 ? "s" : ""} à traiter
        {compteurs.traitees > 0 && (
          <>
            {" "}· <span className="tabular-nums">{compteurs.traitees}</span> déjà traitée{compteurs.traitees > 1 ? "s" : ""}
          </>
        )}
        . Écoutez les deux, gardez le mieux renseigné ; corrigez au besoin son titre ou son artiste.
      </p>

      {paires === null ? (
        <AdminCardsSkeleton count={4} cols={1} />
      ) : paires.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-muted">Aucun doublon à traiter.</p>
      ) : (
        <ul className="space-y-4 stagger">
          {paires.map((paire) => (
            <li key={paire._id} className="rounded-lg border border-border animate-fade-in-up">
              <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs text-ink-muted">
                <Copy size={13} className="text-accent" />
                {paire.raison === "empreinte"
                  ? `Son identique à ${Math.round((paire.similarite ?? 0) * 1000) / 10} %`
                  : "Même titre, même artiste"}
                {enCours === paire._id && <Loader2 size={13} className="ml-auto animate-spin" />}
              </div>
              <div className="flex flex-col divide-y divide-border sm:flex-row sm:divide-x sm:divide-y-0">
                {carte(paire, paire.a)}
                {carte(paire, paire.b)}
              </div>
              <div className="border-t border-border px-4 py-2">
                <button
                  type="button"
                  disabled={enCours !== null}
                  onClick={() => trancher(paire, { distincts: true }, "Paire classée comme deux morceaux différents.")}
                  className="flex items-center gap-1.5 text-xs text-ink-muted transition-colors hover:text-ink disabled:opacity-60"
                >
                  <Split size={13} />
                  Ce sont deux morceaux différents
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {paires && (page > 1 || suite) && (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-border px-3 py-1.5 text-ink-muted transition-colors hover:border-accent hover:text-ink disabled:opacity-40"
          >
            Précédentes
          </button>
          <span className="text-xs text-ink-muted">Page {page}</span>
          <button
            type="button"
            disabled={!suite}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-border px-3 py-1.5 text-ink-muted transition-colors hover:border-accent hover:text-ink disabled:opacity-40"
          >
            Suivantes
          </button>
        </div>
      )}
    </div>
  );
}
