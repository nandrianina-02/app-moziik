"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Plus, Check, Loader2, BadgeCheck } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { useToast } from "@/context/ToastProvider";
import { readApiError } from "@/lib/readApiError";
import type { PlayableSong } from "@/context/PlayerProvider";

/**
 * Ajout de morceaux à une playlist depuis le catalogue Moziik.
 *
 * Recherche débattue (300 ms) sur /api/search ; à vide, on propose les
 * titres les plus écoutés plutôt qu'un écran blanc — c'est le cas
 * fréquent d'une playlist qu'on démarre.
 *
 * Les titres déjà présents restent affichés mais marqués et non
 * cliquables : les masquer donnerait l'impression que la recherche les a
 * oubliés.
 */
export function AddSongsModal({
  playlistId,
  existingIds,
  onClose,
  onAdded,
}: {
  playlistId: string;
  existingIds: string[];
  onClose: () => void;
  onAdded: (playlist: unknown) => void;
}) {
  const pushToast = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayableSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);

  const search = useCallback(async (q: string) => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      // /api/search ignore les requêtes de moins de 2 caractères : on
      // reste alors sur les titres populaires plutôt que de vider la liste.
      const terme = q.trim();
      const url =
        terme.length >= 2
          ? `/api/search?q=${encodeURIComponent(terme)}`
          : `/api/songs?sort=popular&limit=30`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (id !== requestId.current) return; // réponse périmée
      setResults((data.songs ?? []) as PlayableSong[]);
    } catch {
      if (id === requestId.current) setResults([]);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(songId: string) {
    setSelection((prev) => (prev.includes(songId) ? prev.filter((id) => id !== songId) : [...prev, songId]));
  }

  async function handleAdd() {
    if (!selection.length) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/playlists/${playlistId}/songs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songIds: selection }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Échec de l'ajout."));
      const data = await res.json();
      onAdded(data.playlist);
      pushToast("success", `${selection.length} titre${selection.length > 1 ? "s" : ""} ajouté${selection.length > 1 ? "s" : ""}.`);
      onClose();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Échec de l'ajout.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalSheet
      titre="Ajouter des morceaux"
      onClose={onClose}
      entete={
        <>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-base px-3.5 py-2 focus-within:border-accent">
            <Search size={16} className="shrink-0 text-ink-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un titre, un artiste..."
              aria-label="Rechercher un morceau"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            {loading && <Loader2 size={15} className="shrink-0 animate-spin text-ink-muted" />}
          </div>
          {!query && <p className="mt-2 text-xs text-ink-muted">Titres les plus écoutés sur Moziik.</p>}
        </>
      }
      pied={
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-sm text-ink-muted">
            {selection.length > 0
              ? `${selection.length} sélectionné${selection.length > 1 ? "s" : ""}`
              : "Aucune sélection"}
          </span>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              Annuler
            </button>
            <button
              onClick={handleAdd}
              disabled={!selection.length || saving}
              className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-base transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Ajouter
            </button>
          </div>
        </div>
      }
    >
      <ul className="space-y-1">
        {!loading && results.length === 0 && (
          <li className="px-2 py-10 text-center text-sm text-ink-muted">Aucun titre trouvé.</li>
        )}
        {results.map((song) => {
          const deja = existingIds.includes(song._id);
          const choisi = selection.includes(song._id);
          return (
            <li key={song._id}>
              <button
                onClick={() => !deja && toggle(song._id)}
                disabled={deja}
                className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors ${
                  deja ? "opacity-50" : choisi ? "bg-accent/10" : "hover:bg-base"
                }`}
              >
                <SafeImage
                  src={song.coverUrl}
                  alt={song.title}
                  width={40}
                  height={40}
                  className="h-10 w-10 shrink-0 rounded-lg object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{song.title}</span>
                  <span className="flex items-center gap-1 truncate text-xs text-ink-muted">
                    {song.artist?.stageName ?? "Artiste supprimé"}
                    {song.artist?.verified && <BadgeCheck size={11} className="shrink-0 text-verified" />}
                  </span>
                </span>
                {deja ? (
                  <span className="shrink-0 text-xs text-ink-muted">Déjà présent</span>
                ) : (
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors ${
                      choisi ? "border-accent bg-accent text-base" : "border-border text-ink-muted"
                    }`}
                  >
                    {choisi ? <Check size={14} /> : <Plus size={14} />}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </ModalSheet>
  );
}
