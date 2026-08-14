"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePlayer } from "@/context/PlayerProvider";
import { useToast } from "@/context/ToastProvider";
import { readApiError } from "@/lib/readApiError";
import { downloadPlaylistForOffline } from "@/lib/offlineCache";
import { EqualizerLoader } from "@/components/ui/EqualizerLoader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ShareModal } from "@/components/share/ShareModal";
import { buildPlaylistSubject } from "@/components/share/shareSubject";
import { AlbumImageEditModal } from "@/components/album/AlbumImageEditModal";
import { PlaylistContextMenu, type PlaylistMenuTarget } from "@/components/playlist/PlaylistContextMenu";
import { PlaylistHero } from "@/components/playlist/PlaylistHero";
import { PlaylistTabs } from "@/components/playlist/PlaylistTabs";
import { PlaylistSidebar } from "@/components/playlist/PlaylistSidebar";
import { AddSongsModal } from "@/components/playlist/AddSongsModal";
import type { PlaylistDetail, PlaylistSummaryLite } from "@/components/playlist/types";
import type { PlayableSong } from "@/context/PlayerProvider";

type Confirmation = {
  title: string;
  description: string;
  confirmLabel: string;
  action: () => Promise<void>;
};

export default function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const pushToast = useToast();
  const { currentSong, isPlaying, playQueue } = usePlayer();

  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [editingCover, setEditingCover] = useState(false);
  const [showAddSongs, setShowAddSongs] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ done: 0, total: 0 });
  const [showShareModal, setShowShareModal] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [otherPlaylists, setOtherPlaylists] = useState<PlaylistSummaryLite[]>([]);

  async function load() {
    try {
      const res = await fetch(`/api/playlists/${id}`);
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      setPlaylist(data.playlist);
    } catch {
      pushToast("error", "Impossible de charger cette playlist.");
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    fetch("/api/playlists?public=true")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setOtherPlaylists(
          (data.playlists as PlaylistSummaryLite[]).filter((p) => p._id !== id).slice(0, 4)
        );
      })
      .catch(() => {});
  }, [id]);

  const isOwner = !!playlist?.owner && session?.user?.id === playlist.owner._id;
  const canManage = isOwner || session?.user?.role === "admin";

  // Sortir du mode édition sans laisser une sélection fantôme derrière.
  useEffect(() => {
    if (!editMode) setSelection([]);
  }, [editMode]);

  // Si les droits tombent (déconnexion pendant la visite), le mode
  // édition ne doit pas rester ouvert.
  useEffect(() => {
    if (!canManage) setEditMode(false);
  }, [canManage]);

  async function handleDownloadPlaylist() {
    if (!playlist) return;
    setDownloading(true);
    try {
      await downloadPlaylistForOffline(playlist._id, (done, total) => setDownloadProgress({ done, total }));
      pushToast("success", "Playlist disponible hors-ligne.");
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Échec du téléchargement.");
    } finally {
      setDownloading(false);
    }
  }

  /** PATCH des métadonnées. La réponse ne repeuple pas `songs`/`owner` : on
   *  ne fusionne donc que les champs envoyés, jamais la playlist entière. */
  async function patchPlaylist(updates: Partial<PlaylistDetail>) {
    if (!playlist) return;
    const res = await fetch(`/api/playlists/${playlist._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(await readApiError(res, "Échec de l'enregistrement."));
    setPlaylist((prev) => (prev ? { ...prev, ...updates } : prev));
  }

  async function handleSaveMeta({
    title,
    description,
    tags,
  }: {
    title: string;
    description: string;
    tags: string[];
  }) {
    setSavingMeta(true);
    try {
      await patchPlaylist({ title, description, tags });
      pushToast("success", "Playlist mise à jour.");
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Échec de l'enregistrement.");
    } finally {
      setSavingMeta(false);
    }
  }

  async function handleToggleVisibility() {
    if (!playlist) return;
    try {
      await patchPlaylist({ isPublic: !playlist.isPublic });
      pushToast("success", playlist.isPublic ? "Playlist passée en privée." : "Playlist rendue publique.");
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Échec du changement de visibilité.");
    }
  }

  async function handleCoverSaved(url: string | null) {
    setEditingCover(false);
    if (!url) return;
    try {
      await patchPlaylist({ coverUrl: url });
      pushToast("success", "Pochette mise à jour.");
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Échec de l'enregistrement de la pochette.");
    }
  }

  /**
   * Réorganisation optimiste : l'ordre s'applique immédiatement à
   * l'écran, sinon chaque déplacement attendrait un aller-retour réseau
   * et le glisser-déposer paraîtrait cassé. En cas d'échec, l'ordre
   * précédent est restauré et l'erreur affichée — on ne laisse jamais
   * l'écran mentir sur l'état réel.
   */
  async function handleReorder(songIds: string[]) {
    if (!playlist) return;
    const precedent = playlist.songs;
    const parId = new Map(precedent.map((s) => [s._id, s]));
    const reordonne = songIds.map((sid) => parId.get(sid)).filter(Boolean) as PlayableSong[];
    setPlaylist({ ...playlist, songs: reordonne });

    try {
      const res = await fetch(`/api/playlists/${playlist._id}/songs`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songIds }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Échec de la réorganisation."));
    } catch (err) {
      setPlaylist((prev) => (prev ? { ...prev, songs: precedent } : prev));
      pushToast("error", err instanceof Error ? err.message : "Échec de la réorganisation.");
    }
  }

  async function removeSongs(songIds: string[]) {
    if (!playlist) return;
    const res = await fetch(`/api/playlists/${playlist._id}/songs`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songIds }),
    });
    if (!res.ok) throw new Error(await readApiError(res, "Échec de la suppression."));
    const data = await res.json();
    setPlaylist(data.playlist);
    setSelection((prev) => prev.filter((sid) => !songIds.includes(sid)));
  }

  function askRemoveOne(song: PlayableSong) {
    setConfirmation({
      title: "Retirer ce titre ?",
      description: `« ${song.title} » sera retiré de la playlist. Le titre reste disponible sur Moziik.`,
      confirmLabel: "Retirer",
      action: () => removeSongs([song._id]),
    });
  }

  function askRemoveSelected() {
    const n = selection.length;
    setConfirmation({
      title: `Retirer ${n} titre${n > 1 ? "s" : ""} ?`,
      description: `${n} titre${n > 1 ? "s seront retirés" : " sera retiré"} de la playlist. ${
        n > 1 ? "Ils restent disponibles" : "Il reste disponible"
      } sur Moziik.`,
      confirmLabel: "Retirer",
      action: () => removeSongs([...selection]),
    });
  }

  async function runConfirmation() {
    if (!confirmation) return;
    setConfirmBusy(true);
    try {
      await confirmation.action();
      pushToast("success", "Playlist mise à jour.");
      setConfirmation(null);
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setConfirmBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <EqualizerLoader />
      </div>
    );
  }

  if (notFound || !playlist) {
    return <p className="px-6 py-16 text-center text-sm text-ink-muted">Cette playlist est introuvable.</p>;
  }

  const isCurrentPlaylistPlaying = isPlaying && playlist.songs.some((s) => s._id === currentSong?._id);
  const totalPlays = playlist.songs.reduce((sum, s) => sum + (s.playsCount ?? 0), 0);
  const totalLikes = playlist.songs.reduce((sum, s) => sum + (s.likesCount ?? 0), 0);
  const totalDuration = playlist.songs.reduce((sum, s) => sum + (s.duration ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 md:px-10 md:py-10">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <PlaylistHero
            playlist={playlist}
            totalPlays={totalPlays}
            totalDuration={totalDuration}
            isCurrentPlaylistPlaying={isCurrentPlaylistPlaying}
            downloading={downloading}
            downloadProgress={downloadProgress}
            canManage={canManage}
            editMode={editMode}
            savingMeta={savingMeta}
            onTogglePlayAll={() => playQueue(playlist.songs, 0, { type: "playlist", label: playlist.title })}
            onDownloadAll={handleDownloadPlaylist}
            onShare={() => setShowShareModal(true)}
            onOpenMore={(x, y) => setMenuPosition({ x, y })}
            onToggleEditMode={() => setEditMode((v) => !v)}
            onEditCover={() => setEditingCover(true)}
            onSaveMeta={handleSaveMeta}
            onToggleVisibility={handleToggleVisibility}
          />

          <div className="mt-6">
            {/* `editMode` ne peut être vrai que si `canManage` l'est : toute
                action d'édition est donc hors de portée d'un visiteur. */}
            <PlaylistTabs
              playlist={playlist}
              otherPlaylists={otherPlaylists}
              canManage={canManage}
              editMode={editMode}
              selection={selection}
              onToggleSelected={(songId) =>
                setSelection((prev) =>
                  prev.includes(songId) ? prev.filter((s) => s !== songId) : [...prev, songId]
                )
              }
              onSelectAll={() => setSelection(playlist.songs.map((s) => s._id))}
              onClearSelection={() => setSelection([])}
              onReorder={handleReorder}
              onRemoveOne={askRemoveOne}
              onRemoveSelected={askRemoveSelected}
              onOpenAddSongs={() => setShowAddSongs(true)}
              onReload={load}
            />
          </div>
        </div>

        <PlaylistSidebar
          playlist={playlist}
          totalPlays={totalPlays}
          totalLikes={totalLikes}
          otherPlaylists={otherPlaylists}
        />
      </div>

      {showShareModal && (
        <ShareModal
          // `owner` normalisé : il peut être absent en base (compte
          // supprimé) alors que le sujet de partage attend un nom.
          subject={buildPlaylistSubject({
            ...playlist,
            owner: playlist.owner ? { name: playlist.owner.name ?? "Utilisateur supprimé" } : undefined,
          })}
          privacy={{
            isPublic: playlist.isPublic,
            isOwner,
            onTogglePublic: handleToggleVisibility,
          }}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {menuPosition && (
        <PlaylistContextMenu
          playlist={playlist as unknown as PlaylistMenuTarget}
          position={menuPosition}
          isOwner={isOwner}
          canManage={canManage}
          onClose={() => setMenuPosition(null)}
          onDeleted={() => setNotFound(true)}
          onUpdated={(updated) => setPlaylist((prev) => (prev ? { ...prev, isPublic: updated.isPublic } : prev))}
        />
      )}

      {canManage && editingCover && (
        <AlbumImageEditModal
          kind="cover"
          currentUrl={playlist.coverUrl}
          title="Modifier la pochette de la playlist"
          onClose={() => setEditingCover(false)}
          onSaved={handleCoverSaved}
        />
      )}

      {canManage && showAddSongs && (
        <AddSongsModal
          playlistId={playlist._id}
          existingIds={playlist.songs.map((s) => s._id)}
          onClose={() => setShowAddSongs(false)}
          onAdded={(updated) => setPlaylist(updated as PlaylistDetail)}
        />
      )}

      {confirmation && (
        <ConfirmDialog
          title={confirmation.title}
          description={confirmation.description}
          confirmLabel={confirmation.confirmLabel}
          busy={confirmBusy}
          onConfirm={runConfirmation}
          onCancel={() => setConfirmation(null)}
        />
      )}
    </div>
  );
}
