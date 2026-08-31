"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ListPlus,
  ListStart,
  ListMusic,
  Heart,
  DownloadCloud,
  Info,
  Mic2,
  Disc3,
  Share2,
  Trash2,
  Pencil,
  MessageCircle,
  Link2,
} from "lucide-react";
import { usePlayer, type PlayableSong } from "@/context/PlayerProvider";
import { useToast } from "@/context/ToastProvider";
import { useOnlineStatus } from "@/context/OnlineStatusProvider";
import { AddToPlaylistModal } from "@/components/modals/AddToPlaylistModal";
import { CreditsModal } from "@/components/modals/CreditsModal";
import { ShareModal } from "@/components/share/ShareModal";
import { buildSongSubject } from "@/components/share/shareSubject";
import { ContextMenuShell, MenuItem, MenuSeparator } from "@/components/ui/ContextMenuShell";
import {
  downloadSongForOffline,
  isSongOffline,
  removeOfflineSong,
  queuePendingDownload,
} from "@/lib/offlineCache";
import { enqueueSyncAction } from "@/lib/syncQueue";

type Position = { x: number; y: number };

export function SongContextMenu({
  song,
  position,
  canManage,
  hideOffline,
  onClose,
  onDeleted,
}: {
  song: PlayableSong;
  position: Position;
  canManage?: boolean;
  /** Masque l'entrée "Écouter hors-ligne" quand un bouton dédié l'affiche déjà ailleurs (ex. mini-player). */
  hideOffline?: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const pushToast = useToast();
  const { isOnline } = useOnlineStatus();
  const { enqueue, playNextInQueue, currentSong } = usePlayer();
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [liked, setLiked] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    isSongOffline(song._id).then(setOffline);
  }, [song._id]);

  // Tant qu'une sous-modale (playlist / crédits / partage) est ouverte,
  // le petit panneau de menu n'est pas rendu.
  const showSubModal = showAddToPlaylist || showCredits || showShareModal;

  async function handleLike() {
    const nextLiked = !liked;
    if (!isOnline) {
      setLiked(nextLiked);
      await enqueueSyncAction({
        type: "like_song",
        songId: song._id,
        liked: nextLiked,
      });
      pushToast("info", "Sera synchronisé à la reconnexion.");
      onClose();
      return;
    }
    try {
      const res = await fetch(`/api/songs/${song._id}/like`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLiked(data.liked);
      pushToast(
        "success",
        data.liked ? "Ajouté à tes favoris." : "Retiré de tes favoris.",
      );
    } catch {
      pushToast("error", "Connecte-toi pour aimer un son.");
    }
    onClose();
  }

  async function handleToggleOffline() {
    try {
      if (offline) {
        await removeOfflineSong(song._id);
        pushToast("success", "Retiré du mode hors-ligne.");
      } else if (!isOnline) {
        await queuePendingDownload({
          _id: song._id,
          title: song.title,
          coverUrl: song.coverUrl,
          audioUrl: song.audioUrl,
          duration: song.duration,
          artist: song.artist ?? { _id: "", stageName: "Artiste supprimé" },
        });
        pushToast(
          "info",
          "En attente — le téléchargement démarrera à la reconnexion.",
        );
      } else {
        await downloadSongForOffline({
          _id: song._id,
          title: song.title,
          coverUrl: song.coverUrl,
          audioUrl: song.audioUrl,
          duration: song.duration,
          artist: song.artist ?? { _id: "", stageName: "Artiste supprimé" },
        });
        pushToast("success", "Disponible hors-ligne.");
      }
    } catch (err) {
      pushToast(
        "error",
        err instanceof Error ? err.message : "Échec du mode hors-ligne.",
      );
    }
    onClose();
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}/son/${song._id}`;
    await navigator.clipboard.writeText(url);
    pushToast("success", "Lien copié dans le presse-papiers.");
    onClose();
  }

  async function handleDelete() {
    const res = await fetch(`/api/songs/${song._id}`, { method: "DELETE" });
    if (!res.ok) {
      pushToast("error", "La suppression a échoué.");
      return;
    }
    pushToast("success", "Son supprimé.");
    onDeleted?.();
    onClose();
  }

  const albumId = typeof song.album === "object" ? song.album?._id : song.album;
  const albumTitle = typeof song.album === "object" ? song.album?.title : undefined;

  return (
    <>
      {!showSubModal && (
        <ContextMenuShell anchor={position} onClose={onClose}>
          {/* « Écouter le prochain » se glisse juste derrière le morceau en
              cours, là où « Ajouter à la file » range en dernier. L'entrée
              n'a de sens que si quelque chose joue déjà — sinon les deux
              reviendraient au même. */}
          {currentSong && currentSong._id !== song._id && (
            <MenuItem
              icon={ListStart}
              label="Écouter le prochain"
              onClick={() => {
                playNextInQueue(song);
                pushToast("success", "Sera lu juste après le morceau en cours.");
                onClose();
              }}
            />
          )}
          <MenuItem
            icon={ListPlus}
            label="Ajouter à la file d'attente"
            onClick={() => {
              enqueue(song);
              pushToast("success", "Ajouté à la file d'attente.");
              onClose();
            }}
          />
          <MenuItem
            icon={ListMusic}
            label="Ajouter à une playlist"
            onClick={() => setShowAddToPlaylist(true)}
          />
          <MenuItem
            icon={Heart}
            label={liked ? "Ne plus aimer" : "J'aime"}
            onClick={handleLike}
          />
          {!hideOffline && (
            <MenuItem
              icon={DownloadCloud}
              label={offline ? "Retirer du hors-ligne" : "Écouter hors-ligne"}
              onClick={handleToggleOffline}
            />
          )}
          <MenuItem icon={Share2} label="Partager" onClick={() => setShowShareModal(true)} />
          <MenuItem
            icon={Link2}
            label="Copier le lien"
            onClick={handleCopyLink}
          />

          <MenuSeparator />

          <MenuItem
            icon={MessageCircle}
            label="Voir le son et les commentaires"
            onClick={() => {
              router.push(`/son/${song._id}`);
              onClose();
            }}
          />
          <MenuItem
            icon={Info}
            label="Voir les crédits"
            onClick={() => setShowCredits(true)}
          />
          {song.artist && (
            <MenuItem
              icon={Mic2}
              label="Aller à l'artiste"
              onClick={() => {
                router.push(`/artiste/${song.artist!._id}`);
                onClose();
              }}
            />
          )}
          {albumId && (
            <MenuItem
              icon={Disc3}
              label="Aller à l'album"
              onClick={() => {
                router.push(`/album/${albumId}`);
                onClose();
              }}
            />
          )}

          {canManage && (
            <>
              <MenuSeparator />
              <MenuItem
                icon={Pencil}
                label="Modifier"
                onClick={() => {
                  router.push(`/son/${song._id}/modifier`);
                  onClose();
                }}
              />
              <MenuItem
                icon={Trash2}
                label="Supprimer"
                danger
                onClick={handleDelete}
              />
            </>
          )}
        </ContextMenuShell>
      )}

      {showAddToPlaylist && (
        <AddToPlaylistModal
          songId={song._id}
          onClose={() => {
            setShowAddToPlaylist(false);
            onClose();
          }}
        />
      )}
      {showCredits && (
        <CreditsModal
          song={song}
          onClose={() => {
            setShowCredits(false);
            onClose();
          }}
        />
      )}
      {showShareModal && (
        <ShareModal
          subject={buildSongSubject(song, albumTitle)}
          onClose={() => {
            setShowShareModal(false);
            onClose();
          }}
          onOpenAddToPlaylist={() => setShowAddToPlaylist(true)}
        />
      )}
    </>
  );
}
