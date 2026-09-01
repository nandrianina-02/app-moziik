"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Music2, Info, MessageSquare, Users, Pencil } from "lucide-react";
import { TrackTable } from "@/components/music/TrackTable";
import { AlbumCommentsTab } from "@/components/album/AlbumCommentsTab";
import { CompactAlbumRow } from "@/components/song/CompactAlbumRow";
import type { AlbumDetail, AlbumSummaryLite } from "@/components/album/types";

type TabValue = "titres" | "apropos" | "comments" | "similar";

export function AlbumTabs({
  album,
  commentsCount,
  moreFromArtist,
  canManage,
  editMode,
  onReload,
  onSaveDescription,
}: {
  album: AlbumDetail;
  commentsCount: number;
  moreFromArtist: AlbumSummaryLite[];
  canManage: boolean;
  editMode: boolean;
  onReload: () => void;
  onSaveDescription: (description: string) => Promise<void>;
}) {
  const tabs: { value: TabValue; label: string; icon: typeof Info; badge?: number }[] = [
    { value: "titres", label: "Titres", icon: Music2 },
    { value: "apropos", label: "À propos", icon: Info },
    { value: "comments", label: "Commentaires", icon: MessageSquare, badge: commentsCount },
    { value: "similar", label: "Fans aussi aiment", icon: Users },
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
            {typeof t.badge === "number" && t.badge > 0 && (
              <span className="rounded-full bg-base px-1.5 py-0.5 text-[10px] text-ink-muted">{t.badge}</span>
            )}
            {tab === t.value && (
              <motion.span
                layoutId="album-tab-underline"
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
          {tab === "titres" && <TitresTab album={album} onReload={onReload} />}
          {tab === "apropos" && (
            <AProposTab album={album} canManage={canManage} editMode={editMode} onSave={onSaveDescription} />
          )}
          {tab === "comments" && <AlbumCommentsTab albumId={album._id} />}
          {tab === "similar" && <SimilarTab albums={moreFromArtist} artistName={album.artist?.stageName} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function TitresTab({ album, onReload }: { album: AlbumDetail; onReload: () => void }) {
  if (album.songs.length === 0) {
    return (
      <p className="rounded-xl2 border border-dashed border-border p-8 text-center text-sm text-ink-muted">
        Aucun titre publié dans cet album pour le moment.
      </p>
    );
  }
  // Tableau commun à la page album et à la page playlist (colonnes
  // pochette / titre / favori / artiste / album / durée), pour que les
  // deux pages restent identiques. Les titres d'un album ne portent pas
  // toujours la référence peuplée vers celui-ci : on la fournit.
  return (
    <TrackTable
      songs={album.songs}
      source={{ type: "album", label: album.title }}
      albumFallback={{ id: album._id, title: album.title }}
      onReload={onReload}
    />
  );
}

function AProposTab({
  album,
  canManage,
  editMode,
  onSave,
}: {
  album: AlbumDetail;
  canManage: boolean;
  editMode: boolean;
  onSave: (description: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(album.description ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(value.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl2 border border-border bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium">À propos de l&apos;album</h3>
          {canManage && editMode && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              <Pencil size={12} /> Modifier
            </button>
          )}
        </div>

        {editing ? (
          <div>
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value.slice(0, 2000))}
              rows={5}
              placeholder="Décris cet album pour tes auditeurs..."
              className="w-full resize-none rounded-xl border border-border bg-base px-4 py-3 text-sm outline-none focus:border-accent"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={() => {
                  setEditing(false);
                  setValue(album.description ?? "");
                }}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-accent px-3.5 py-1.5 text-xs font-medium text-base hover:bg-accent-hover disabled:opacity-60"
              >
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        ) : album.description?.trim() ? (
          <p className="selectionnable whitespace-pre-line text-sm leading-relaxed text-ink-muted">{album.description}</p>
        ) : (
          <p className="text-sm italic text-ink-muted">
            {album.artist?.stageName ?? "L'artiste"} n&apos;a pas encore ajouté de description pour cet album.
          </p>
        )}
      </div>

      {album.artist?.bio?.trim() && (
        <div className="rounded-xl2 border border-border bg-surface p-5">
          <h3 className="mb-2 text-sm font-medium">À propos de l&apos;artiste</h3>
          <p className="selectionnable whitespace-pre-line text-sm leading-relaxed text-ink-muted">{album.artist.bio}</p>
        </div>
      )}
    </div>
  );
}

function SimilarTab({ albums, artistName }: { albums: AlbumSummaryLite[]; artistName?: string }) {
  if (albums.length === 0) {
    return (
      <p className="rounded-xl2 border border-dashed border-border p-8 text-center text-sm text-ink-muted">
        Aucun autre album à recommander pour le moment.
      </p>
    );
  }
  return (
    <div className="rounded-xl2 border border-border bg-surface p-4">
      <p className="mb-3 px-1 text-xs text-ink-muted">
        {artistName ? `D'autres sorties de ${artistName} :` : "Fans aussi aiment :"}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {albums.map((a) => (
          <CompactAlbumRow key={a._id} album={a} />
        ))}
      </div>
    </div>
  );
}
