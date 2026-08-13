"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePlayer } from "@/context/PlayerProvider";
import { useToast } from "@/context/ToastProvider";
import { useOnlineStatus } from "@/context/OnlineStatusProvider";
import {
  downloadSongForOffline,
  isSongOffline,
  removeOfflineSong,
  queuePendingDownload,
} from "@/lib/offlineCache";
import { AddToPlaylistModal } from "@/components/modals/AddToPlaylistModal";
import { SongContextMenu } from "@/components/music/SongContextMenu";
import { ShareModal } from "@/components/share/ShareModal";
import { buildSongSubject } from "@/components/share/shareSubject";
import { SongHero } from "@/components/song/SongHero";
import { SongTabs } from "@/components/song/SongTabs";
import { SongSidebar } from "@/components/song/SongSidebar";
import { SongDetailSkeleton } from "@/components/song/SongDetailSkeleton";
import type {
  SongDetail,
  AlbumSummary,
  PlaylistSummary,
} from "@/components/song/types";
import type { PlayableSong } from "@/context/PlayerProvider";

export default function SongDetailPage() {
  const { id } = useParams<{ id: string }>();
  const pushToast = useToast();
  const { status, data: session } = useSession();
  const { isOnline } = useOnlineStatus();
  const { currentSong, isPlaying, playQueue, togglePlay, enqueue } =
    usePlayer();

  const [song, setSong] = useState<SongDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [liked, setLiked] = useState(false);
  const [offline, setOffline] = useState(false);
  const [offlineBusy, setOfflineBusy] = useState(false);

  const [album, setAlbum] = useState<AlbumSummary | null>(null);
  const [similarSongs, setSimilarSongs] = useState<PlayableSong[]>([]);
  const [artistSongs, setArtistSongs] = useState<PlayableSong[]>([]);
  const [artistAlbums, setArtistAlbums] = useState<AlbumSummary[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [commentsCount, setCommentsCount] = useState(0);

  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    async function loadSong() {
      setLoading(true);
      setNotFound(false);
      try {
        const res = await fetch(`/api/songs/${id}`);
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        setSong(data.song);
      } catch {
        pushToast("error", "Impossible de charger ce son.");
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    loadSong();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // État "aimé" réel de l'utilisateur connecté (l'ancien menu contextuel
  // ne le faisait pas et démarrait toujours à `false` — ici on l'initialise
  // correctement dès le chargement).
  useEffect(() => {
    if (!song) return;
    fetch(`/api/songs/${song._id}/like`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setLiked(data.liked))
      .catch(() => {});
    isSongOffline(song._id).then(setOffline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song?._id]);

  useEffect(() => {
    if (!song) return;

    fetch(`/api/songs/${song._id}/comments`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setCommentsCount(data.comments.length))
      .catch(() => {});

    const albumId =
      typeof song.album === "object" ? song.album?._id : song.album;
    if (albumId) {
      fetch(`/api/albums/${albumId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => data && setAlbum(data.album))
        .catch(() => {});
    } else {
      setAlbum(null);
    }

    if (song.genre) {
      fetch(`/api/songs?genre=${encodeURIComponent(song.genre)}&limit=8`)
        .then((res) => (res.ok ? res.json() : null))
        .then(
          (data) =>
            data &&
            setSimilarSongs(
              data.songs.filter((s: PlayableSong) => s._id !== song._id),
            ),
        );
    }

    if (song.artist) {
      fetch(`/api/artists/${song.artist._id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data) return;
          setArtistSongs(
            data.songs.filter((s: PlayableSong) => s._id !== song._id),
          );
          setArtistAlbums(data.albums);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song?._id, song?.genre, song?.artist?._id]);

  useEffect(() => {
    if (status !== "authenticated" || !song) return;
    fetch(`/api/playlists?owner=me`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setPlaylists(
          data.playlists.filter((p: PlaylistSummary) =>
            p.songs.includes(song._id),
          ),
        );
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, song?._id]);

  if (loading) return <SongDetailSkeleton />;
  if (notFound || !song) {
    return (
      <p className="px-6 py-16 text-center text-sm text-ink-muted">
        Ce son est introuvable.
      </p>
    );
  }

  // Alias non-nullable : TypeScript ne propage pas le rétrécissement de
  // `song` (fait plus haut avec le early-return) à l'intérieur des
  // fonctions imbriquées ci-dessous.
  const activeSong = song;

  const isCurrent = currentSong?._id === activeSong._id;
  const canManage =
    session?.user?.role === "admin" ||
    (session?.user?.role === "artist" &&
      session.user.id === activeSong.artist?._id);

  async function toggleLike() {
    if (status !== "authenticated") {
      pushToast("error", "Connecte-toi pour aimer un son.");
      return;
    }
    const optimistic = !liked;
    setLiked(optimistic);
    setSong((prev) =>
      prev
        ? {
            ...prev,
            likesCount: (prev.likesCount ?? 0) + (optimistic ? 1 : -1),
          }
        : prev,
    );
    try {
      const res = await fetch(`/api/songs/${activeSong._id}/like`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLiked(data.liked);
      setSong((prev) =>
        prev ? { ...prev, likesCount: data.likesCount } : prev,
      );
    } catch {
      setLiked(!optimistic);
      setSong((prev) =>
        prev
          ? {
              ...prev,
              likesCount: (prev.likesCount ?? 0) - (optimistic ? 1 : -1),
            }
          : prev,
      );
      pushToast("error", "Action impossible pour le moment.");
    }
  }

  async function toggleOffline() {
    setOfflineBusy(true);
    try {
      if (offline) {
        await removeOfflineSong(activeSong._id);
        setOffline(false);
        pushToast("success", "Retiré du mode hors-ligne.");
      } else if (!isOnline) {
        await queuePendingDownload({
          _id: activeSong._id,
          title: activeSong.title,
          coverUrl: activeSong.coverUrl,
          audioUrl: activeSong.audioUrl,
          duration: activeSong.duration,
          artist: activeSong.artist ?? {
            _id: "",
            stageName: "Artiste supprimé",
          },
        });
        pushToast(
          "info",
          "En attente — le téléchargement démarrera à la reconnexion.",
        );
      } else {
        await downloadSongForOffline({
          _id: activeSong._id,
          title: activeSong.title,
          coverUrl: activeSong.coverUrl,
          audioUrl: activeSong.audioUrl,
          duration: activeSong.duration,
          artist: activeSong.artist ?? {
            _id: "",
            stageName: "Artiste supprimé",
          },
        });
        setOffline(true);
        pushToast("success", "Disponible hors-ligne.");
      }
    } catch (err) {
      pushToast(
        "error",
        err instanceof Error ? err.message : "Échec du mode hors-ligne.",
      );
    } finally {
      setOfflineBusy(false);
    }
  }

  function handleShared(sharesCount: number) {
    setSong((prev) => (prev ? { ...prev, sharesCount } : prev));
  }

  return (
    <div className="px-4 py-6 sm:px-6 md:px-10 md:py-10">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <SongHero
            song={song}
            album={album}
            commentsCount={commentsCount}
            isCurrent={isCurrent}
            isPlaying={isPlaying}
            liked={liked}
            offline={offline}
            offlineBusy={offlineBusy}
            onTogglePlay={() =>
              isCurrent ? togglePlay() : playQueue([song], 0)
            }
            onToggleLike={toggleLike}
            onToggleOffline={toggleOffline}
            onShare={() => setShowShareModal(true)}
            onAddToQueue={() => {
              enqueue(song);
              pushToast("success", "Ajouté à la file d'attente.");
            }}
            onAddToPlaylist={() => setShowAddToPlaylist(true)}
            onOpenMore={(x, y) => setMenuPosition({ x, y })}
          />

          <div className="mt-6">
            <SongTabs
              song={song}
              album={album}
              commentsCount={commentsCount}
              similarSongs={similarSongs}
              artistSongs={artistSongs}
            />
          </div>
        </div>

        <SongSidebar
          song={song}
          album={album}
          similarSongs={similarSongs}
          artistSongs={artistSongs}
          artistAlbums={artistAlbums}
          playlists={playlists}
          isAuthenticated={status === "authenticated"}
        />
      </div>

      {showAddToPlaylist && (
        <AddToPlaylistModal
          songId={song._id}
          onClose={() => setShowAddToPlaylist(false)}
        />
      )}

      {showShareModal && (
        <ShareModal
          subject={buildSongSubject(activeSong, album?.title)}
          onClose={() => setShowShareModal(false)}
          onShared={handleShared}
          onOpenAddToPlaylist={() => setShowAddToPlaylist(true)}
        />
      )}

      {menuPosition && (
        <SongContextMenu
          song={song}
          position={menuPosition}
          canManage={canManage}
          hideOffline
          onClose={() => setMenuPosition(null)}
          onDeleted={() => setNotFound(true)}
        />
      )}
    </div>
  );
}
