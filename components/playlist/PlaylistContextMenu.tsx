"use client";

import { useState } from "react";
import { Play, ListPlus, Share2, DownloadCloud, Trash2, Loader2, Globe2, Lock } from "lucide-react";
import { usePlayer, type PlayableSong } from "@/context/PlayerProvider";
import { useToast } from "@/context/ToastProvider";
import { downloadPlaylistForOffline } from "@/lib/offlineCache";
import { ContextMenuShell, MenuItem, MenuSeparator } from "@/components/ui/ContextMenuShell";
import { ShareModal } from "@/components/share/ShareModal";
import { buildPlaylistSubject } from "@/components/share/shareSubject";

export type PlaylistMenuTarget = {
  _id: string;
  title: string;
  coverUrl?: string;
  isPublic: boolean;
  owner: { _id: string; name: string };
  songs: PlayableSong[];
};

export function PlaylistContextMenu({
  playlist,
  position,
  isOwner,
  canManage,
  onClose,
  onDeleted,
  onUpdated,
}: {
  playlist: PlaylistMenuTarget;
  position: { x: number; y: number };
  isOwner?: boolean;
  canManage?: boolean;
  onClose: () => void;
  onDeleted?: () => void;
  onUpdated?: (playlist: PlaylistMenuTarget) => void;
}) {
  const pushToast = useToast();
  const { playQueue, enqueue } = usePlayer();
  const [showShareModal, setShowShareModal] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [togglingPublic, setTogglingPublic] = useState(false);
  const [isPublic, setIsPublic] = useState(playlist.isPublic);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadPlaylistForOffline(playlist._id);
      pushToast("success", "Playlist disponible hors-ligne.");
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Échec du téléchargement.");
    } finally {
      setDownloading(false);
      onClose();
    }
  }

  async function handleTogglePublic() {
    setTogglingPublic(true);
    try {
      const res = await fetch(`/api/playlists/${playlist._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !isPublic }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setIsPublic(data.playlist.isPublic);
      onUpdated?.({ ...playlist, isPublic: data.playlist.isPublic });
      pushToast("success", data.playlist.isPublic ? "Playlist rendue publique." : "Playlist rendue privée.");
    } catch {
      pushToast("error", "Impossible de modifier la visibilité.");
    } finally {
      setTogglingPublic(false);
    }
  }

  async function handleDelete() {
    const res = await fetch(`/api/playlists/${playlist._id}`, { method: "DELETE" });
    if (!res.ok) {
      pushToast("error", "La suppression a échoué.");
      return;
    }
    pushToast("success", "Playlist supprimée.");
    onDeleted?.();
    onClose();
  }

  return (
    <>
      {!showShareModal && (
        <ContextMenuShell anchor={position} onClose={onClose}>
          {playlist.songs.length > 0 && (
            <>
              <MenuItem
                icon={Play}
                label="Écouter"
                onClick={() => {
                  playQueue(playlist.songs, 0);
                  onClose();
                }}
              />
              <MenuItem
                icon={ListPlus}
                label="Ajouter à la file d'attente"
                onClick={() => {
                  playlist.songs.forEach((s) => enqueue(s));
                  pushToast(
                    "success",
                    playlist.songs.length > 1
                      ? `${playlist.songs.length} titres ajoutés à la file d'attente.`
                      : "Ajouté à la file d'attente."
                  );
                  onClose();
                }}
              />
              <MenuItem
                icon={downloading ? Loader2 : DownloadCloud}
                label={downloading ? "Téléchargement..." : "Télécharger"}
                onClick={handleDownload}
                disabled={downloading}
              />
            </>
          )}
          {(isPublic || isOwner) && (
            <MenuItem icon={Share2} label="Partager" onClick={() => setShowShareModal(true)} />
          )}

          {isOwner && (
            <>
              <MenuSeparator />
              <MenuItem
                icon={togglingPublic ? Loader2 : isPublic ? Lock : Globe2}
                label={isPublic ? "Rendre privée" : "Rendre publique"}
                onClick={handleTogglePublic}
                disabled={togglingPublic}
              />
            </>
          )}

          {canManage && (
            <>
              <MenuSeparator />
              <MenuItem icon={Trash2} label="Supprimer" danger onClick={handleDelete} />
            </>
          )}
        </ContextMenuShell>
      )}

      {showShareModal && (
        <ShareModal
          subject={buildPlaylistSubject({ ...playlist, isPublic })}
          privacy={{ isPublic, isOwner: !!isOwner, busy: togglingPublic, onTogglePublic: handleTogglePublic }}
          onClose={() => {
            setShowShareModal(false);
            onClose();
          }}
        />
      )}
    </>
  );
}
