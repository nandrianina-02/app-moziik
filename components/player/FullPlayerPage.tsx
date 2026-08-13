"use client";

import { useEffect, useRef, useState } from "react";
import { SafeImage } from "@/components/ui/SafeImage";
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  BadgeCheck,
  ListMusic,
  ListPlus,
  Shuffle,
  Repeat,
  Repeat1,
  Download,
  Check,
  Loader2,
  MoreHorizontal,
  Heart,
  Mic2,
  Flame,
  Share2,
  Info,
  Volume2,
  Volume1,
  VolumeX,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePlayer } from "@/context/PlayerProvider";
import { useToast } from "@/context/ToastProvider";
import { useOnlineStatus } from "@/context/OnlineStatusProvider";
import { SeekBar } from "@/components/player/SeekBar";
import { EQPanel } from "@/components/player/panels/EQPanel";
import { QueuePanel } from "@/components/player/panels/QueuePanel";
import { LyricsSheet } from "@/components/player/LyricsSheet";
import { SongContextMenu } from "@/components/music/SongContextMenu";
import { AddToPlaylistModal } from "@/components/modals/AddToPlaylistModal";
import { ShareModal } from "@/components/share/ShareModal";
import { buildSongSubject } from "@/components/share/shareSubject";
import { downloadSongForOffline, isSongOffline, removeOfflineSong, queuePendingDownload } from "@/lib/offlineCache";

// Intensité appliquée quand le Bass Boost mobile est activé (interrupteur
// on/off, à la différence du slider fin de l'égaliseur desktop).
const MOBILE_BASS_BOOST_PERCENT = 65;

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Distance de glissement (px) à partir de laquelle le lecteur se ferme au relâchement.
const CLOSE_THRESHOLD = 120;

export function FullPlayerPage() {
  const {
    queue,
    currentSong,
    isPlaying,
    progress,
    volume,
    setVolume,
    togglePlay,
    playNext,
    playPrevious,
    seek,
    isFullPlayerOpen,
    closeFullPlayer,
    isShuffled,
    toggleShuffle,
    repeatMode,
    cycleRepeatMode,
    bassBoostPercent,
    setBassBoost,
  } = usePlayer();
  const pushToast = useToast();
  const { isOnline } = useOnlineStatus();

  const [offlineState, setOfflineState] = useState<"idle" | "saving" | "saved">("idle");
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

  const [liked, setLiked] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showQueueSheet, setShowQueueSheet] = useState(false);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Glissement vers le bas pour fermer (zone d'en-tête + pochette/titre).
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef(0);

  useEffect(() => {
    if (!currentSong) return;
    let cancelled = false;
    isSongOffline(currentSong._id).then((offline) => {
      if (!cancelled) setOfflineState(offline ? "saved" : "idle");
    });
    fetch(`/api/songs/${currentSong._id}/like`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setLiked(data.liked);
      });
    return () => {
      cancelled = true;
    };
  }, [currentSong]);

  function handlePointerDown(e: React.PointerEvent) {
    startYRef.current = e.clientY;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    const delta = e.clientY - startYRef.current;
    if (delta > 0) setDragY(delta);
  }

  function handlePointerUp() {
    if (!dragging) return;
    setDragging(false);
    if (dragY > CLOSE_THRESHOLD) {
      closeFullPlayer();
    }
    setDragY(0);
  }

  if (!isFullPlayerOpen || !currentSong) return null;

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
    if (!currentSong) return;
    const nextLiked = !liked;
    setLiked(nextLiked);
    try {
      const res = await fetch(`/api/songs/${currentSong._id}/like`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLiked(data.liked);
      pushToast("success", data.liked ? "Ajouté à tes favoris." : "Retiré de tes favoris.");
    } catch {
      setLiked(!nextLiked);
      pushToast("error", "Connecte-toi pour aimer un son.");
    }
  }

  function handleShare() {
    if (!currentSong) return;
    setShowShareModal(true);
  }

  function handleToggleBassBoost() {
    setBassBoost(bassBoostPercent > 0 ? 0 : MOBILE_BASS_BOOST_PERCENT);
  }

  const RepeatIcon = repeatMode === "one" ? Repeat1 : Repeat;
  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const dragProgress = Math.min(1, dragY / (CLOSE_THRESHOLD * 2));

  const hasLyrics = !!currentSong.lyrics && currentSong.lyrics.trim().length > 0;
  const currentIndex = queue.findIndex((s) => s._id === currentSong._id);
  const upcoming = currentIndex >= 0 ? queue.slice(currentIndex + 1, currentIndex + 3) : [];
  const bassBoostOn = bassBoostPercent > 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-base flex flex-col animate-toast-in"
      style={{
        transform: `translateY(${dragY}px)`,
        opacity: 1 - dragProgress * 0.4,
        transition: dragging ? "none" : "transform 0.25s ease, opacity 0.25s ease",
      }}
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="touch-none"
      >
        <header className="flex items-center justify-between px-6 py-4 cursor-grab active:cursor-grabbing">
          <button onClick={closeFullPlayer} aria-label="Fermer le lecteur" className="text-ink-muted hover:text-ink">
            <ChevronDown size={22} />
          </button>
          <span className="flex flex-col items-center gap-1.5 text-xs uppercase tracking-wide text-ink-muted">
            En cours de lecture
            <span className="hidden h-0.5 w-8 rounded-full bg-accent md:block" />
          </span>
          <button
            onClick={(e) => setMenuPosition({ x: e.clientX, y: e.clientY })}
            aria-label="Autres options"
            className="text-ink-muted hover:text-ink"
          >
            <MoreHorizontal size={20} />
          </button>
        </header>

        {/* Poignée visuelle indiquant que la zone se glisse */}
        <div className="flex justify-center pb-2 -mt-2">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
      <div className="flex flex-col items-center md:hidden">
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenuPosition({ x: e.clientX, y: e.clientY });
          }}
          className="relative cursor-grab active:cursor-grabbing touch-none"
        >
          <SafeImage
            src={currentSong.coverUrl}
            alt={currentSong.title}
            width={280}
            height={280}
            className="rounded-xl2 object-cover shadow-2xl mb-6"
            priority
          />
          {hasLyrics && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowLyrics(true);
              }}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3.5 py-2 text-xs font-medium text-white backdrop-blur-sm"
            >
              <Mic2 size={13} /> Paroles
            </button>
          )}
        </div>

        <div className="w-full max-w-md">
          {/* En-tête titre — mobile : cœur "J'aime" (le hors-ligne reste accessible via le menu "..."). */}
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-display">{currentSong.title}</h1>
              <p className="flex items-center gap-1 text-sm text-ink-muted">
                {currentSong.artist?.stageName ?? "Artiste supprimé"}
                {currentSong.artist?.verified && <BadgeCheck size={14} className="text-verified" />}
              </p>
            </div>
            <button
              onClick={handleToggleLike}
              aria-label={liked ? "Ne plus aimer" : "J'aime"}
              aria-pressed={liked}
              className={`shrink-0 transition-colors ${liked ? "text-accent" : "text-ink-muted hover:text-ink"}`}
            >
              <Heart size={22} fill={liked ? "currentColor" : "none"} />
            </button>
          </div>

          <SeekBar progress={progress} duration={currentSong.duration} onSeek={seek} variant="pill" />
          <div className="flex justify-between text-xs text-ink-muted mb-6 -mt-1">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(currentSong.duration)}</span>
          </div>

          <div className="flex items-center justify-center gap-5 mb-10">
            <button
              onClick={toggleShuffle}
              aria-label="Lecture aléatoire"
              aria-pressed={isShuffled}
              className={`transition-colors ${isShuffled ? "text-accent" : "text-ink-muted hover:text-ink"}`}
            >
              <Shuffle size={18} />
            </button>
            <button onClick={playPrevious} aria-label="Précédent" className="text-ink hover:text-accent">
              <SkipBack size={24} />
            </button>
            <button
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause" : "Lecture"}
              className="grid h-16 w-16 place-items-center rounded-full bg-accent text-base hover:bg-accent-hover"
            >
              {isPlaying ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
            </button>
            <button onClick={playNext} aria-label="Suivant" className="text-ink hover:text-accent">
              <SkipForward size={24} />
            </button>
            <button
              onClick={cycleRepeatMode}
              aria-label="Répéter"
              aria-pressed={repeatMode !== "off"}
              className={`transition-colors ${repeatMode !== "off" ? "text-accent" : "text-ink-muted hover:text-ink"}`}
            >
              <RepeatIcon size={18} />
            </button>
          </div>

          {/* ---------- Mobile : bass boost + accès rapide file d'attente / playlist + "à suivre" ---------- */}
          <div className="w-full">
            <div className="flex gap-2 mb-5">
              <button
                onClick={() => setShowQueueSheet(true)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-medium text-ink-muted hover:border-accent hover:text-accent"
              >
                <ListMusic size={14} /> File d&apos;attente
              </button>
              <button
                onClick={() => setShowAddToPlaylist(true)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-medium text-ink-muted hover:border-accent hover:text-accent"
              >
                <ListPlus size={14} /> Ajouter à la playlist
              </button>
            </div>

            <button
              onClick={handleToggleBassBoost}
              aria-pressed={bassBoostOn}
              className="w-full rounded-xl2 border border-border bg-surface px-4 py-3.5 mb-6 text-left"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Flame size={15} className="text-accent" /> Bass Boost
                </span>
                <span
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    bassBoostOn ? "bg-accent" : "bg-border"
                  }`}
                >
                  <span
                    className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white transition-transform ${
                      bassBoostOn ? "translate-x-[22px]" : "translate-x-[3px]"
                    }`}
                  />
                </span>
              </div>
              <p className="text-[11px] text-ink-muted mt-1.5">
                Renforce les basses et compense le volume pour un son plus puissant.
              </p>
            </button>

            {upcoming.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium">À suivre</h2>
                  <button
                    onClick={() => setShowQueueSheet(true)}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    Tout voir
                  </button>
                </div>
                <div className="space-y-1">
                  {upcoming.map((song) => (
                    <div key={song._id} className="flex items-center gap-3 rounded-xl px-1.5 py-1.5">
                      <SafeImage
                        src={song.coverUrl}
                        alt={song.title}
                        width={40}
                        height={40}
                        className="shrink-0 rounded-lg object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{song.title}</span>
                        <span className="block truncate text-xs text-ink-muted">
                          {song.artist?.stageName ?? "Artiste supprimé"}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-ink-muted">{formatTime(song.duration)}</span>
                      <button
                        onClick={(e) => setMenuPosition({ x: e.clientX, y: e.clientY })}
                        aria-label="Options du son"
                        className="shrink-0 text-ink-muted hover:text-ink"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---------- Desktop / tablette : mise en page 3 colonnes (pochette+actions / lecture+égaliseur / file d'attente) ---------- */}
      <div className="hidden md:grid md:max-w-6xl md:grid-cols-[280px_1fr_320px] md:items-start md:gap-8 md:mx-auto md:w-full">
        {/* Colonne gauche : pochette, titre, actions */}
        <div>
          <SafeImage
            src={currentSong.coverUrl}
            alt={currentSong.title}
            width={280}
            height={280}
            className="mb-4 aspect-square w-full rounded-xl2 object-cover shadow-2xl"
            priority
          />
          <div className="mb-4 text-center">
            <p className="truncate text-lg font-display">{currentSong.title}</p>
            <p className="flex items-center justify-center gap-1 text-sm text-ink-muted">
              {currentSong.artist?.stageName ?? "Artiste supprimé"}
              {currentSong.artist?.verified && <BadgeCheck size={13} className="text-verified" />}
            </p>
          </div>
          <div className="space-y-1 border-t border-border pt-3">
            <button
              onClick={handleToggleLike}
              aria-pressed={liked}
              className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-sm transition-colors hover:bg-surface ${
                liked ? "text-accent" : "text-ink-muted hover:text-ink"
              }`}
            >
              <Heart size={17} fill={liked ? "currentColor" : "none"} />
              {liked ? "Retirer des favoris" : "Ajouter aux favoris"}
            </button>
            <button
              onClick={handleToggleOffline}
              disabled={offlineState === "saving"}
              className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-sm transition-colors hover:bg-surface ${
                offlineState === "saved" ? "text-accent" : "text-ink-muted hover:text-ink"
              }`}
            >
              {offlineState === "saving" ? (
                <Loader2 size={17} className="animate-spin" />
              ) : offlineState === "saved" ? (
                <Check size={17} />
              ) : (
                <Download size={17} />
              )}
              {offlineState === "saved" ? "Disponible hors-ligne" : "Télécharger"}
            </button>
            <button
              onClick={handleShare}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-sm text-ink-muted transition-colors hover:bg-surface hover:text-ink"
            >
              <Share2 size={17} /> Partager
            </button>
            <Link
              href={`/son/${currentSong._id}`}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-sm text-ink-muted transition-colors hover:bg-surface hover:text-ink"
            >
              <Info size={17} /> Informations sur le titre
            </Link>
          </div>
        </div>

        {/* Colonne centrale : lecture + égaliseur */}
        <div className="mx-auto w-full max-w-xl">
          <div className="mb-1 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-3xl font-display">{currentSong.title}</h1>
              <p className="mt-1 flex items-center gap-1 text-sm text-ink-muted">
                {currentSong.artist?.stageName ?? "Artiste supprimé"}
                {currentSong.artist?.verified && <BadgeCheck size={14} className="text-verified" />}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 pt-1">
              <button
                onClick={handleToggleOffline}
                aria-label={offlineState === "saved" ? "Retirer du hors-ligne" : "Télécharger"}
                disabled={offlineState === "saving"}
                className={`transition-colors ${offlineState === "saved" ? "text-accent" : "text-ink-muted hover:text-ink"}`}
              >
                {offlineState === "saving" ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : offlineState === "saved" ? (
                  <Check size={20} />
                ) : (
                  <Download size={20} />
                )}
              </button>
              <button
                onClick={(e) => setMenuPosition({ x: e.clientX, y: e.clientY })}
                aria-label="Autres options"
                className="text-ink-muted hover:text-ink"
              >
                <MoreHorizontal size={20} />
              </button>
            </div>
          </div>

          <div className="mb-8 mt-6">
            <SeekBar progress={progress} duration={currentSong.duration} onSeek={seek} variant="pill" />
            <div className="-mt-1 flex justify-between text-xs text-ink-muted">
              <span>{formatTime(progress)}</span>
              <span>{formatTime(currentSong.duration)}</span>
            </div>
          </div>

          <div className="mb-8 flex items-center justify-center gap-6">
            <button
              onClick={toggleShuffle}
              aria-label="Lecture aléatoire"
              aria-pressed={isShuffled}
              className={`transition-colors ${isShuffled ? "text-accent" : "text-ink-muted hover:text-ink"}`}
            >
              <Shuffle size={19} />
            </button>
            <button onClick={playPrevious} aria-label="Précédent" className="text-ink transition-colors hover:text-accent">
              <SkipBack size={26} fill="currentColor" />
            </button>
            <button
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause" : "Lecture"}
              className="grid h-16 w-16 place-items-center rounded-full bg-accent text-base transition-transform hover:scale-105 hover:bg-accent-hover"
            >
              {isPlaying ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" className="ml-0.5" />}
            </button>
            <button onClick={playNext} aria-label="Suivant" className="text-ink transition-colors hover:text-accent">
              <SkipForward size={26} fill="currentColor" />
            </button>
            <button
              onClick={cycleRepeatMode}
              aria-label="Répéter"
              aria-pressed={repeatMode !== "off"}
              className={`transition-colors ${repeatMode !== "off" ? "text-accent" : "text-ink-muted hover:text-ink"}`}
            >
              <RepeatIcon size={19} />
            </button>
          </div>

          <div className="mb-8 flex items-center gap-3">
            <button
              onClick={() => setVolume(volume > 0 ? 0 : 1)}
              aria-label={volume === 0 ? "Réactiver le son" : "Couper le son"}
              className="shrink-0 text-ink-muted hover:text-ink"
            >
              <VolumeIcon size={18} />
            </button>
            <SeekBar progress={volume} duration={1} onSeek={setVolume} variant="pill" className="flex-1" />
            <Volume2 size={18} className="shrink-0 text-ink-muted" />
          </div>

          <EQPanel />
        </div>

        {/* Colonne droite : file d'attente persistante */}
        <div className="sticky top-6 max-h-[75vh] overflow-y-auto rounded-xl2 border border-border bg-surface p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">File d&apos;attente</h2>
          <QueuePanel />
        </div>
      </div>
      </div>

      {menuPosition && (
        <SongContextMenu song={currentSong} position={menuPosition} onClose={() => setMenuPosition(null)} />
      )}

      {showLyrics && currentSong.lyrics && (
        <LyricsSheet
          title={currentSong.title}
          artist={currentSong.artist?.stageName}
          lyrics={currentSong.lyrics}
          onClose={() => setShowLyrics(false)}
        />
      )}

      {showQueueSheet && (
        <div
          className="md:hidden fixed inset-0 z-[60] flex items-end justify-center bg-black/60"
          onClick={() => setShowQueueSheet(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[75vh] w-full flex-col rounded-t-3xl bg-surface animate-toast-in"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <ListMusic size={15} className="text-accent" /> File d&apos;attente
              </span>
              <button
                onClick={() => setShowQueueSheet(false)}
                aria-label="Fermer la file d'attente"
                className="text-ink-muted hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto px-3 py-3">
              <QueuePanel />
            </div>
          </div>
        </div>
      )}

      {showAddToPlaylist && <AddToPlaylistModal songId={currentSong._id} onClose={() => setShowAddToPlaylist(false)} />}
      {showShareModal && <ShareModal subject={buildSongSubject(currentSong)} onClose={() => setShowShareModal(false)} onOpenAddToPlaylist={() => setShowAddToPlaylist(true)} />}
    </div>
  );
}
