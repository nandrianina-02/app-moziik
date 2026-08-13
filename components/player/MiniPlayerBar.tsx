"use client";

import { useEffect, useState } from "react";
import { SafeImage } from "@/components/ui/SafeImage";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Download,
  Check,
  Loader2,
  MoreHorizontal,
  BadgeCheck,
  Heart,
  ListMusic,
  ListPlus,
  Share2,
  Volume2,
  Volume1,
  VolumeX,
  Maximize2,
} from "lucide-react";
import { usePlayer } from "@/context/PlayerProvider";
import { useToast } from "@/context/ToastProvider";
import { useOnlineStatus } from "@/context/OnlineStatusProvider";
import { useSession } from "next-auth/react";
import { SeekBar } from "@/components/player/SeekBar";
import { SongContextMenu } from "@/components/music/SongContextMenu";
import { useLongPress } from "@/components/music/useLongPress";
import { AddToPlaylistModal } from "@/components/modals/AddToPlaylistModal";
import { ShareModal } from "@/components/share/ShareModal";
import { buildSongSubject } from "@/components/share/shareSubject";
import { getOfflineSettings } from "@/lib/offlineSettings";
import { downloadSongForOffline, isSongOffline, removeOfflineSong, queuePendingDownload } from "@/lib/offlineCache";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const bitrateLabel = { low: "64 kbps", medium: "128 kbps", high: "320 kbps" } as const;

export function MiniPlayerBar() {
  const {
    currentSong,
    queue,
    isPlaying,
    progress,
    volume,
    setVolume,
    togglePlay,
    playNext,
    playPrevious,
    seek,
    openFullPlayer,
    isShuffled,
    toggleShuffle,
    repeatMode,
    cycleRepeatMode,
  } = usePlayer();
  const { status: authStatus } = useSession();
  const pushToast = useToast();
  const { isOnline } = useOnlineStatus();

  const [offlineState, setOfflineState] = useState<"idle" | "saving" | "saved">("idle");
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [liked, setLiked] = useState(false);
  const longPress = useLongPress((x, y) => setMenuPosition({ x, y }));
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [bitrate, setBitrate] = useState<string>(bitrateLabel.high);

  useEffect(() => {
    if (!currentSong) return;
    let cancelled = false;
    isSongOffline(currentSong._id).then((offline) => {
      if (!cancelled) setOfflineState(offline ? "saved" : "idle");
    });
    return () => {
      cancelled = true;
    };
  }, [currentSong]);

  useEffect(() => {
    if (!currentSong || authStatus !== "authenticated") {
      setLiked(false);
      return;
    }
    fetch(`/api/songs/${currentSong._id}/like`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setLiked(data.liked))
      .catch(() => {});
  }, [currentSong, authStatus]);

  useEffect(() => {
    getOfflineSettings().then((s) => setBitrate(bitrateLabel[s.audioQuality]));
    const handler = () => getOfflineSettings().then((s) => setBitrate(bitrateLabel[s.audioQuality]));
    window.addEventListener("moziik-offline-settings-change", handler);
    return () => window.removeEventListener("moziik-offline-settings-change", handler);
  }, []);

  if (!currentSong) return null;

  async function handleToggleOffline() {
    if (!currentSong || offlineState === "saving") return;
    try {
      if (offlineState === "saved") {
        await removeOfflineSong(currentSong._id);
        setOfflineState("idle");
        pushToast("success", "Retiré du mode hors-ligne.");
      } else if (!isOnline) {
        await queuePendingDownload({
          _id: currentSong._id,
          title: currentSong.title,
          coverUrl: currentSong.coverUrl,
          audioUrl: currentSong.audioUrl,
          duration: currentSong.duration,
          artist: currentSong.artist ?? { _id: "", stageName: "Artiste supprimé" },
        });
        pushToast("info", "En attente — le téléchargement démarrera à la reconnexion.");
      } else {
        setOfflineState("saving");
        await downloadSongForOffline({
          _id: currentSong._id,
          title: currentSong.title,
          coverUrl: currentSong.coverUrl,
          audioUrl: currentSong.audioUrl,
          duration: currentSong.duration,
          artist: currentSong.artist ?? { _id: "", stageName: "Artiste supprimé" },
        });
        setOfflineState("saved");
        pushToast("success", "Disponible hors-ligne.");
      }
    } catch (err) {
      setOfflineState("idle");
      pushToast("error", err instanceof Error ? err.message : "Échec du mode hors-ligne.");
    }
  }

  async function handleToggleLike() {
    if (authStatus !== "authenticated") {
      pushToast("error", "Connecte-toi pour aimer un son.");
      return;
    }
    const next = !liked;
    setLiked(next); // optimiste
    try {
      const res = await fetch(`/api/songs/${currentSong!._id}/like`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLiked(data.liked);
    } catch {
      setLiked(!next);
      pushToast("error", "Échec de l'action.");
    }
  }

  function handleShare() {
    if (!currentSong) return;
    setShowShareModal(true);
  }

  const RepeatIcon = repeatMode === "one" ? Repeat1 : Repeat;
  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-surface shadow-[0_-8px_32px_-16px_rgba(0,0,0,0.25)] md:bottom-0">
      {/* Ligne 1 : piste + actions */}
      <div className="flex items-center gap-3 px-3 py-2.5 md:gap-4 md:px-5 md:py-3">
        {/* Piste en cours */}
        <button
          onClick={openFullPlayer}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenuPosition({ x: e.clientX, y: e.clientY });
          }}
          onTouchStart={longPress.onTouchStart}
          onTouchEnd={(e) => {
            longPress.onTouchEnd();
            if (longPress.wasLongPress()) e.preventDefault();
          }}
          onTouchMove={longPress.onTouchMove}
          className="flex min-w-0 flex-1 items-center gap-3 text-left md:w-80 md:flex-none"
        >
          <SafeImage
            src={currentSong.coverUrl}
            alt={currentSong.title}
            width={56}
            height={56}
            className="h-11 w-11 shrink-0 rounded-xl object-cover md:h-14 md:w-14"
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">{currentSong.title}</span>
            <span className="flex items-center gap-1 truncate text-xs text-ink-muted">
              {currentSong.artist?.stageName ?? "Artiste supprimé"}
              {currentSong.artist?.verified && <BadgeCheck size={12} className="shrink-0 text-verified" />}
            </span>
            <span className="mt-1.5 hidden items-center gap-1.5 md:flex">
              <span className="rounded-md bg-base px-2 py-0.5 text-[10px] font-medium text-ink-muted">MP3</span>
              <span className="rounded-md bg-base px-2 py-0.5 text-[10px] font-medium text-ink-muted">{bitrate}</span>
              <span className="rounded-md bg-base px-2 py-0.5 text-[10px] font-medium text-ink-muted">44.1 kHz</span>
            </span>
          </span>
        </button>

        {/* Coeur — desktop uniquement */}
        <button
          onClick={handleToggleLike}
          aria-label={liked ? "Ne plus aimer" : "J'aime"}
          className={`hidden shrink-0 transition-colors md:block ${liked ? "text-accent" : "text-ink-muted hover:text-ink"}`}
        >
          <Heart size={20} fill={liked ? "currentColor" : "none"} />
        </button>

        <div className="hidden h-6 w-px shrink-0 bg-border md:block" />

        {/* Mobile : télécharger, suivant, pause (grand) — dans cet ordre */}
        <div className="flex shrink-0 items-center gap-3 md:hidden">
          <button
            onClick={handleToggleOffline}
            disabled={offlineState === "saving"}
            aria-label={offlineState === "saved" ? "Retirer du hors-ligne" : "Télécharger"}
            className={`shrink-0 transition-colors ${
              offlineState === "saved" ? "text-accent" : "text-ink-muted hover:text-ink"
            }`}
          >
            {offlineState === "saving" ? (
              <Loader2 size={19} className="animate-spin" />
            ) : offlineState === "saved" ? (
              <Check size={19} />
            ) : (
              <Download size={19} />
            )}
          </button>
          <button onClick={playNext} aria-label="Suivant" className="shrink-0 text-ink transition-colors hover:text-accent">
            <SkipForward size={22} fill="currentColor" />
          </button>
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Lecture"}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-base transition-colors hover:bg-accent-hover"
          >
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
          </button>
        </div>

        {/* Desktop : cluster central — transport */}
        <div className="hidden md:flex md:items-center md:gap-5 md:px-2">
          <button
            onClick={toggleShuffle}
            aria-label="Lecture aléatoire"
            aria-pressed={isShuffled}
            className={`transition-colors ${isShuffled ? "text-accent" : "text-ink-muted hover:text-ink"}`}
          >
            <Shuffle size={17} />
          </button>
          <button onClick={playPrevious} aria-label="Précédent" className="text-ink transition-colors hover:text-accent">
            <SkipBack size={20} fill="currentColor" />
          </button>
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Lecture"}
            className="grid h-10 w-10 place-items-center rounded-full bg-ink text-base transition-transform hover:scale-105"
          >
            {isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" className="ml-0.5" />}
          </button>
          <button onClick={playNext} aria-label="Suivant" className="text-ink transition-colors hover:text-accent">
            <SkipForward size={20} fill="currentColor" />
          </button>
          <button
            onClick={cycleRepeatMode}
            aria-label="Répéter"
            aria-pressed={repeatMode !== "off"}
            className={`transition-colors ${repeatMode !== "off" ? "text-accent" : "text-ink-muted hover:text-ink"}`}
          >
            <RepeatIcon size={17} />
          </button>
        </div>

        <div className="hidden h-6 w-px shrink-0 bg-border md:block" />

        {/* Droite : actions avec libellés, desktop uniquement */}
        <div className="hidden md:flex md:flex-1 md:items-start md:justify-end md:gap-6">
          <button
            onClick={openFullPlayer}
            className="flex flex-col items-center gap-1 text-ink-muted transition-colors hover:text-ink"
          >
            <span className="relative inline-flex">
              <ListMusic size={18} />
              {queue.length > 0 && (
                <span
                  className="absolute grid place-items-center rounded-full bg-accent font-semibold text-base"
                  style={{
                    top: -6,
                    right: -8,
                    height: 16,
                    minWidth: 16,
                    padding: "0 4px",
                    fontSize: 9,
                    lineHeight: 1,
                  }}
                >
                  {queue.length > 9 ? "9+" : queue.length}
                </span>
              )}
            </span>
            <span className="text-[11px]">File d&apos;attente</span>
          </button>

          <button
            onClick={() => setShowAddToPlaylist(true)}
            className="flex flex-col items-center gap-1 text-ink-muted transition-colors hover:text-ink"
          >
            <ListPlus size={18} />
            <span className="text-[11px]">Ajouter</span>
          </button>

          <button
            onClick={handleToggleOffline}
            disabled={offlineState === "saving"}
            className={`flex flex-col items-center gap-1 transition-colors ${
              offlineState === "saved" ? "text-accent" : "text-ink-muted hover:text-ink"
            }`}
          >
            {offlineState === "saving" ? (
              <Loader2 size={18} className="animate-spin" />
            ) : offlineState === "saved" ? (
              <Check size={18} />
            ) : (
              <Download size={18} />
            )}
            <span className="text-[11px]">Télécharger</span>
          </button>

          <button onClick={handleShare} className="flex flex-col items-center gap-1 text-ink-muted transition-colors hover:text-ink">
            <Share2 size={18} />
            <span className="text-[11px]">Partager</span>
          </button>

          <button
            onClick={(e) => setMenuPosition({ x: e.clientX, y: e.clientY })}
            className="flex flex-col items-center gap-1 text-ink-muted transition-colors hover:text-ink"
          >
            <MoreHorizontal size={18} />
            <span className="text-[11px]">Plus</span>
          </button>
        </div>
      </div>

      {/* Ligne 2, mobile uniquement : la durée reste collée aux commandes, pas isolée en haut de barre */}
      <div className="flex items-center gap-2 px-3 pb-2.5 md:hidden">
        <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-ink-muted">
          {formatTime(progress)}
        </span>
        <SeekBar progress={progress} duration={currentSong.duration} onSeek={seek} variant="pill" className="min-w-0 flex-1" />
        <span className="w-8 shrink-0 text-[10px] tabular-nums text-ink-muted">
          {formatTime(currentSong.duration)}
        </span>
      </div>

      {/* Ligne 2, desktop uniquement : progression + volume + agrandir */}
      <div className="hidden items-center gap-4 px-5 pb-3 md:flex">
        <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-ink-muted">
          {formatTime(progress)}
        </span>
        <SeekBar progress={progress} duration={currentSong.duration} onSeek={seek} variant="pill" className="flex-1" />
        <span className="w-9 shrink-0 text-[11px] tabular-nums text-ink-muted">
          {formatTime(currentSong.duration)}
        </span>

        <div className="mx-1 h-4 w-px bg-border" />

        <div className="flex w-36 shrink-0 items-center gap-2">
          <button
            onClick={() => setVolume(volume > 0 ? 0 : 1)}
            aria-label={volume === 0 ? "Réactiver le son" : "Couper le son"}
            className="shrink-0 text-ink-muted hover:text-ink"
          >
            <VolumeIcon size={17} />
          </button>
          <SeekBar progress={volume} duration={1} onSeek={setVolume} variant="pill" />
        </div>

        <button
          onClick={openFullPlayer}
          aria-label="Lecteur plein écran"
          className="shrink-0 text-ink-muted hover:text-ink"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {menuPosition && (
        <SongContextMenu
          song={currentSong}
          position={menuPosition}
          hideOffline
          onClose={() => setMenuPosition(null)}
        />
      )}
      {showAddToPlaylist && (
        <AddToPlaylistModal songId={currentSong._id} onClose={() => setShowAddToPlaylist(false)} />
      )}
      {showShareModal && <ShareModal subject={buildSongSubject(currentSong)} onClose={() => setShowShareModal(false)} onOpenAddToPlaylist={() => setShowAddToPlaylist(true)} />}
    </div>
  );
}