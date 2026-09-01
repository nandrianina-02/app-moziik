"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, ListPlus, Share2, Mic2, Trash2 } from "lucide-react";
import { usePlayer, type PlayableSong } from "@/context/PlayerProvider";
import { useToast } from "@/context/ToastProvider";
import { ContextMenuShell, MenuItem, MenuSeparator } from "@/components/ui/ContextMenuShell";
import { ShareModal } from "@/components/share/ShareModal";
import { buildAlbumSubject } from "@/components/share/shareSubject";
import type { AlbumType } from "@/lib/albums";

export type AlbumMenuTarget = {
  _id: string;
  title: string;
  coverUrl: string;
  type: AlbumType;
  releaseDate: string;
  artist: { _id: string; stageName: string; verified?: boolean } | null;
  songs?: PlayableSong[];
};

export function AlbumContextMenu({
  album,
  position,
  canManage,
  onClose,
  onDeleted,
}: {
  album: AlbumMenuTarget;
  position: { x: number; y: number };
  canManage?: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const pushToast = useToast();
  const { playQueue, enqueue } = usePlayer();
  const [showShareModal, setShowShareModal] = useState(false);

  const songs = album.songs ?? [];

  async function handleDelete() {
    const res = await fetch(`/api/albums/${album._id}`, { method: "DELETE" });
    if (!res.ok) {
      pushToast("error", "La suppression a échoué.");
      return;
    }
    pushToast("success", "Album supprimé.");
    onDeleted?.();
    onClose();
  }

  return (
    <>
      {!showShareModal && (
        <ContextMenuShell anchor={position} onClose={onClose}>
          {songs.length > 0 && (
            <>
              <MenuItem
                icon={Play}
                label="Écouter"
                onClick={() => {
                  playQueue(songs, 0, { type: "album", label: album.title, id: album._id });
                  onClose();
                }}
              />
              <MenuItem
                icon={ListPlus}
                label="Ajouter à la file d'attente"
                onClick={() => {
                  songs.forEach((s) => enqueue(s));
                  pushToast(
                    "success",
                    songs.length > 1 ? `${songs.length} titres ajoutés à la file d'attente.` : "Ajouté à la file d'attente."
                  );
                  onClose();
                }}
              />
            </>
          )}
          <MenuItem icon={Share2} label="Partager" onClick={() => setShowShareModal(true)} />
          {album.artist && (
            <MenuItem
              icon={Mic2}
              label="Aller à l'artiste"
              onClick={() => {
                router.push(`/artiste/${album.artist!._id}`);
                onClose();
              }}
            />
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
          subject={buildAlbumSubject(album)}
          onClose={() => {
            setShowShareModal(false);
            onClose();
          }}
        />
      )}
    </>
  );
}
