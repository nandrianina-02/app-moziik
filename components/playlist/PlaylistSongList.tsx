"use client";

import { useState } from "react";
import { GripVertical, Trash2, ChevronUp, ChevronDown, Plus, ListMusic, X } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { SongRow } from "@/components/music/SongRow";
import type { PlayableSong } from "@/context/PlayerProvider";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Liste des morceaux d'une playlist, en deux modes.
 *
 * Lecture : réutilise SongRow, strictement comme avant — mêmes clics,
 * même menu contextuel, même comportement que partout ailleurs.
 *
 * Édition (propriétaire ou admin uniquement) : lignes dédiées avec
 * poignée de glissement, case à cocher et suppression.
 *
 * Le glisser-déposer utilise l'API native HTML5, sans dépendance
 * supplémentaire — mais elle ne réagit pas au tactile. Des flèches
 * monter/descendre doublent donc systématiquement la fonction : sans
 * elles, réorganiser serait impossible sur mobile.
 */
export function PlaylistSongList({
  songs,
  editMode,
  selection,
  onToggleSelected,
  onSelectAll,
  onClearSelection,
  onReorder,
  onRemoveOne,
  onRemoveSelected,
  onOpenAddSongs,
}: {
  songs: PlayableSong[];
  editMode: boolean;
  selection: string[];
  onToggleSelected: (songId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onReorder: (songIds: string[]) => void;
  onRemoveOne: (song: PlayableSong) => void;
  onRemoveSelected: () => void;
  onOpenAddSongs: () => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function deplacer(from: number, to: number) {
    if (to < 0 || to >= songs.length || from === to) return;
    const ordre = songs.map((s) => s._id);
    const [retire] = ordre.splice(from, 1);
    ordre.splice(to, 0, retire);
    onReorder(ordre);
  }

  if (songs.length === 0) {
    return (
      <div className="rounded-xl2 border border-dashed border-border px-6 py-14 text-center">
        <ListMusic size={28} className="mx-auto text-ink-muted" />
        <p className="mt-3 text-sm text-ink-muted">Cette playlist est vide pour l&apos;instant.</p>
        {editMode && (
          <button
            onClick={onOpenAddSongs}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
          >
            <Plus size={15} /> Ajouter des morceaux
          </button>
        )}
      </div>
    );
  }

  if (!editMode) {
    return (
      <div className="space-y-1">
        {songs.map((song, index) => (
          <SongRow
            key={song._id}
            song={song}
            queue={songs}
            index={index}
            source={{ type: "playlist" }}
          />
        ))}
      </div>
    );
  }

  const tousSelectionnes = selection.length === songs.length;

  return (
    <div>
      {/* Barre d'actions groupées — n'apparaît qu'avec une sélection, pour
          ne pas encombrer l'écran le reste du temps. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={onOpenAddSongs}
          className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
        >
          <Plus size={15} /> Ajouter des morceaux
        </button>
        <button
          onClick={tousSelectionnes ? onClearSelection : onSelectAll}
          className="rounded-xl border border-border px-3.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:border-accent hover:text-ink"
        >
          {tousSelectionnes ? "Tout désélectionner" : "Tout sélectionner"}
        </button>

        {selection.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-1.5">
            <span className="text-sm font-medium text-accent">
              {selection.length} sélectionné{selection.length > 1 ? "s" : ""}
            </span>
            <button
              onClick={onRemoveSelected}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-accent transition-colors hover:bg-accent/15"
            >
              <Trash2 size={14} /> Retirer
            </button>
            <button
              onClick={onClearSelection}
              aria-label="Annuler la sélection"
              className="text-ink-muted transition-colors hover:text-ink"
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>

      <p className="mb-3 text-xs text-ink-muted">
        Glisse une ligne pour la déplacer, ou utilise les flèches sur mobile.
      </p>

      <ul className="space-y-1">
        {songs.map((song, index) => {
          const selectionne = selection.includes(song._id);
          return (
            <li
              key={song._id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragEnter={() => setOverIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDragEnd={() => {
                if (dragIndex !== null && overIndex !== null) deplacer(dragIndex, overIndex);
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDrop={(e) => e.preventDefault()}
              className={`flex items-center gap-3 rounded-xl border px-2 py-2 transition-colors ${
                selectionne ? "border-accent/40 bg-accent/10" : "border-transparent hover:bg-surface"
              } ${dragIndex === index ? "opacity-40" : ""} ${
                overIndex === index && dragIndex !== null && dragIndex !== index ? "border-accent" : ""
              }`}
            >
              <span
                aria-hidden
                className="hidden cursor-grab text-ink-muted active:cursor-grabbing sm:block"
                title="Glisser pour déplacer"
              >
                <GripVertical size={16} />
              </span>

              {/* accent-accent, et non var(--accent) : cette variable-là
                  n'a jamais existé (elle s'appelle --color-accent), la case
                  retombait donc toujours sur le corail figé du repli. */}
              <input
                type="checkbox"
                checked={selectionne}
                onChange={() => onToggleSelected(song._id)}
                aria-label={`Sélectionner ${song.title}`}
                className="h-4 w-4 shrink-0 accent-accent"
              />

              <span className="w-5 shrink-0 text-center text-xs tabular-nums text-ink-muted">{index + 1}</span>

              <SafeImage
                src={song.coverUrl}
                alt={song.title}
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 rounded-lg object-cover"
              />

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{song.title}</span>
                <span className="block truncate text-xs text-ink-muted">
                  {song.artist?.stageName ?? "Artiste supprimé"}
                </span>
              </span>

              <span className="hidden w-12 shrink-0 text-right text-xs tabular-nums text-ink-muted sm:block">
                {formatTime(song.duration)}
              </span>

              <span className="flex shrink-0 items-center gap-0.5">
                <button
                  onClick={() => deplacer(index, index - 1)}
                  disabled={index === 0}
                  aria-label="Monter"
                  title="Monter"
                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-base hover:text-ink disabled:opacity-30"
                >
                  <ChevronUp size={15} />
                </button>
                <button
                  onClick={() => deplacer(index, index + 1)}
                  disabled={index === songs.length - 1}
                  aria-label="Descendre"
                  title="Descendre"
                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-base hover:text-ink disabled:opacity-30"
                >
                  <ChevronDown size={15} />
                </button>
                <button
                  onClick={() => onRemoveOne(song)}
                  aria-label={`Retirer ${song.title}`}
                  title="Retirer de la playlist"
                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-accent/10 hover:text-accent"
                >
                  <Trash2 size={15} />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
