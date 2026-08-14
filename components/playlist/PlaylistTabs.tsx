"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Music2, Info, ListMusic } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { TrackTable } from "@/components/music/TrackTable";
import { PlaylistSongList } from "@/components/playlist/PlaylistSongList";
import type { PlaylistDetail, PlaylistSummaryLite } from "@/components/playlist/types";
import type { PlayableSong } from "@/context/PlayerProvider";

type TabValue = "titres" | "apropos" | "similar";

/**
 * Onglets de la page playlist, strictement calqués sur AlbumTabs (mêmes
 * styles, même soulignement animé) — les deux pages doivent se lire
 * comme une seule et même famille.
 *
 * Il manque l'onglet « Commentaires » que porte la page album : il
 * n'existe aucune route de commentaires pour les playlists. Un onglet
 * vide serait pire qu'un onglet absent.
 */
export function PlaylistTabs({
  playlist,
  otherPlaylists,
  canManage,
  editMode,
  selection,
  onToggleSelected,
  onSelectAll,
  onClearSelection,
  onReorder,
  onRemoveOne,
  onRemoveSelected,
  onOpenAddSongs,
  onReload,
}: {
  playlist: PlaylistDetail;
  otherPlaylists: PlaylistSummaryLite[];
  canManage: boolean;
  editMode: boolean;
  selection: string[];
  onToggleSelected: (songId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onReorder: (songIds: string[]) => void;
  onRemoveOne: (song: PlayableSong) => void;
  onRemoveSelected: () => void;
  onOpenAddSongs: () => void;
  onReload: () => void;
}) {
  const tabs: { value: TabValue; label: string; icon: typeof Info }[] = [
    { value: "titres", label: "Titres", icon: Music2 },
    { value: "apropos", label: "À propos", icon: Info },
    { value: "similar", label: "Playlists similaires", icon: ListMusic },
  ];
  const [tab, setTab] = useState<TabValue>("titres");

  return (
    <div>
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border pb-px">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`relative flex shrink-0 items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium transition-colors ${
              tab === t.value ? "text-accent" : "text-ink-muted hover:text-ink"
            }`}
          >
            <t.icon size={14} />
            {t.label}
            {tab === t.value && (
              <motion.span
                layoutId="playlist-tab-underline"
                className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-accent"
              />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {tab === "titres" &&
            // En édition, la liste réordonnable remplace le tableau : elle
            // porte les poignées, les cases et les suppressions.
            (canManage && editMode ? (
              <PlaylistSongList
                songs={playlist.songs}
                editMode
                selection={selection}
                onToggleSelected={onToggleSelected}
                onSelectAll={onSelectAll}
                onClearSelection={onClearSelection}
                onReorder={onReorder}
                onRemoveOne={onRemoveOne}
                onRemoveSelected={onRemoveSelected}
                onOpenAddSongs={onOpenAddSongs}
              />
            ) : playlist.songs.length === 0 ? (
              <p className="rounded-xl2 border border-dashed border-border p-8 text-center text-sm text-ink-muted">
                Cette playlist est vide pour l&apos;instant.
              </p>
            ) : (
              <TrackTable
                songs={playlist.songs}
                source={{ type: "playlist", label: playlist.title }}
                onReload={onReload}
              />
            ))}

          {tab === "apropos" && <AProposTab playlist={playlist} />}

          {tab === "similar" && <SimilarTab playlists={otherPlaylists} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function AProposTab({ playlist }: { playlist: PlaylistDetail }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl2 border border-border bg-surface p-5">
        <h3 className="mb-3 text-sm font-medium">À propos de cette playlist</h3>
        {playlist.description?.trim() ? (
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">{playlist.description}</p>
        ) : (
          <p className="text-sm italic text-ink-muted">
            {playlist.owner?.name ?? "Le créateur"} n&apos;a pas encore ajouté de description.
          </p>
        )}

        {playlist.tags && playlist.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {playlist.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-ink-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl2 border border-border bg-surface p-5">
        <h3 className="mb-3 text-sm font-medium">Détails</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Créée par</dt>
            <dd className="truncate font-medium">{playlist.owner?.name ?? "Utilisateur supprimé"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Visibilité</dt>
            <dd className="font-medium">{playlist.isPublic ? "Publique" : "Privée"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Nombre de titres</dt>
            <dd className="font-medium">{playlist.songs.length}</dd>
          </div>
          {playlist.createdAt && (
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Créée le</dt>
              <dd className="font-medium">
                {new Date(playlist.createdAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}

function SimilarTab({ playlists }: { playlists: PlaylistSummaryLite[] }) {
  if (playlists.length === 0) {
    return (
      <p className="rounded-xl2 border border-dashed border-border p-8 text-center text-sm text-ink-muted">
        Aucune autre playlist publique à recommander pour le moment.
      </p>
    );
  }
  return (
    <div className="rounded-xl2 border border-border bg-surface p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {playlists.map((p) => (
          <Link
            key={p._id}
            href={`/playlist/${p._id}`}
            className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-base"
          >
            {p.coverUrl ? (
              <SafeImage
                src={p.coverUrl}
                alt={p.title}
                width={44}
                height={44}
                className="h-11 w-11 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-base text-ink-muted">
                <ListMusic size={17} />
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{p.title}</span>
              <span className="block text-xs text-ink-muted">{p.songs?.length ?? 0} titres</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
