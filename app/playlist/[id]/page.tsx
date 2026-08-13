"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Play, ListMusic, Globe, Lock, DownloadCloud, Loader2, Share2, MoreVertical } from "lucide-react";
import { SongRow } from "@/components/music/SongRow";
import { EqualizerLoader } from "@/components/ui/EqualizerLoader";
import { usePlayer, type PlayableSong } from "@/context/PlayerProvider";
import { useToast } from "@/context/ToastProvider";
import { downloadPlaylistForOffline } from "@/lib/offlineCache";
import { useLongPress } from "@/components/music/useLongPress";
import { PlaylistContextMenu } from "@/components/playlist/PlaylistContextMenu";
import { ShareModal } from "@/components/share/ShareModal";
import { buildPlaylistSubject } from "@/components/share/shareSubject";

type PlaylistDetail = {
  _id: string;
  title: string;
  description?: string;
  coverUrl?: string;
  isPublic: boolean;
  owner: { _id: string; name: string };
  songs: PlayableSong[];
};

export default function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const pushToast = useToast();
  const { playQueue } = usePlayer();
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ done: 0, total: 0 });
  const [showShareModal, setShowShareModal] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

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

  async function load() {
    try {
      const res = await fetch(`/api/playlists/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPlaylist(data.playlist);
    } catch {
      pushToast("error", "Impossible de charger cette playlist.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function openMenuAt(x: number, y: number) {
    setMenuPosition({ x, y });
  }
  const longPress = useLongPress((x, y) => openMenuAt(x, y));

  if (loading || !playlist) {
    return (
      <div className="py-16 grid place-items-center">
        <EqualizerLoader />
      </div>
    );
  }

  const isOwner = session?.user?.id === playlist.owner._id;
  const canManage = isOwner || session?.user?.role === "admin";

  return (
    <div className="px-6 py-8 md:px-10 md:py-10 max-w-4xl">
      <div className="flex items-center gap-5 mb-8">
        <div
          onContextMenu={(e) => {
            e.preventDefault();
            openMenuAt(e.clientX, e.clientY);
          }}
          onTouchStart={longPress.onTouchStart}
          onTouchEnd={longPress.onTouchEnd}
          onTouchMove={longPress.onTouchMove}
        >
          {playlist.coverUrl ? (
            <Image src={playlist.coverUrl} alt={playlist.title} width={120} height={120} className="rounded-xl2 object-cover shadow-lg" />
          ) : (
            <div className="h-[120px] w-[120px] rounded-xl2 bg-surface grid place-items-center shrink-0">
              <ListMusic size={28} className="text-ink-muted" />
            </div>
          )}
        </div>
        <div>
          <p className="flex items-center gap-1 text-xs text-ink-muted mb-1">
            {playlist.isPublic ? <Globe size={11} /> : <Lock size={11} />}
            {playlist.isPublic ? "Playlist publique" : "Playlist privée"}
          </p>
          <h1 className="text-xl font-display mb-1">{playlist.title}</h1>
          {playlist.description && <p className="text-sm text-ink-muted mb-1">{playlist.description}</p>}
          <p className="text-xs text-ink-muted mb-4">
            Par {isOwner ? "toi" : playlist.owner.name} · {playlist.songs.length} son(s)
          </p>

          <div className="flex items-center gap-2">
            {playlist.songs.length > 0 && (
              <>
                <button
                  onClick={() => playQueue(playlist.songs, 0)}
                  className="flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-medium text-base hover:bg-accent-hover"
                >
                  <Play size={14} fill="currentColor" /> Écouter tout
                </button>
                <button
                  onClick={handleDownloadPlaylist}
                  disabled={downloading}
                  className="flex items-center gap-2 rounded-full border border-border px-5 py-2 text-sm font-medium text-ink-muted hover:border-accent hover:text-accent disabled:opacity-60"
                >
                  {downloading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      {downloadProgress.total > 0 && `${downloadProgress.done}/${downloadProgress.total}`}
                    </>
                  ) : (
                    <>
                      <DownloadCloud size={14} /> Télécharger tout
                    </>
                  )}
                </button>
              </>
            )}
            {(playlist.isPublic || isOwner) && (
              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-2 rounded-full border border-border px-5 py-2 text-sm font-medium text-ink-muted hover:border-accent hover:text-accent"
              >
                <Share2 size={14} /> Partager
              </button>
            )}
            <button
              onClick={(e) => openMenuAt(e.clientX, e.clientY)}
              aria-label="Plus d'options"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-ink-muted transition-colors hover:border-accent hover:text-accent"
            >
              <MoreVertical size={15} />
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        {playlist.songs.map((song, index) => (
          <SongRow key={song._id} song={song} queue={playlist.songs} index={index} onDeleted={load} />
        ))}
        {playlist.songs.length === 0 && (
          <p className="text-sm text-ink-muted">Cette playlist est vide pour l&apos;instant.</p>
        )}
      </div>

      {showShareModal && (
        <ShareModal
          subject={buildPlaylistSubject(playlist)}
          privacy={{
            isPublic: playlist.isPublic,
            isOwner,
            onTogglePublic: async () => {
              const res = await fetch(`/api/playlists/${playlist._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isPublic: !playlist.isPublic }),
              });
              if (res.ok) {
                const data = await res.json();
                setPlaylist((prev) => (prev ? { ...prev, isPublic: data.playlist.isPublic } : prev));
              }
            },
          }}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {menuPosition && (
        <PlaylistContextMenu
          playlist={playlist}
          position={menuPosition}
          isOwner={isOwner}
          canManage={canManage}
          onClose={() => setMenuPosition(null)}
          onUpdated={(updated) => setPlaylist((prev) => (prev ? { ...prev, isPublic: updated.isPublic } : prev))}
        />
      )}
    </div>
  );
}
