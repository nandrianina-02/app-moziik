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
import { useSidebar } from "@/context/SidebarProvider";
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

/** Bouton d'action icône seule de la barre droite (desktop). */
function IconAction({
  icon: Icon,
  label,
  active,
  disabled,
  badge,
  onClick,
}: {
  icon: typeof Play;
  label: string;
  active?: boolean;
  disabled?: boolean;
  badge?: number;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors disabled:opacity-50 ${
        active ? "text-accent hover:bg-accent/10" : "text-ink-muted hover:bg-base hover:text-ink"
      }`}
    >
      <Icon size={17} />
      {badge !== undefined && badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-semibold leading-none text-base">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}

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
  const { collapsed } = useSidebar();

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
  const OfflineIcon = offlineState === "saving" ? Loader2 : offlineState === "saved" ? Check : Download;

  // Ouvre le menu contextuel ancré au bouton plutôt qu'au curseur : le
  // lecteur est collé en bas de l'écran, un menu ancré au clic sortirait
  // du cadre visible.
  function openMenuFromButton(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPosition({ x: rect.left, y: rect.top });
  }

  return (
    <div
      className={`fixed bottom-16 left-0 right-0 z-30 border-t border-border bg-surface/95 backdrop-blur-md shadow-[0_-8px_32px_-16px_rgba(0,0,0,0.35)] transition-[left] duration-300 ease-out md:bottom-0 print:hidden ${
        // Décalage exact sur la largeur de la sidebar pour que le lecteur
        // reste dans la zone de contenu et ne passe jamais dessous.
        collapsed ? "md:left-20" : "md:left-64"
      }`}
    >
      {/* ---------- MOBILE ---------- */}
      <div className="md:hidden">
        <div className="flex items-center gap-3 px-3 pt-2.5">
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
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <SafeImage
              src={currentSong.coverUrl}
              alt={currentSong.title}
              width={44}
              height={44}
              className="h-11 w-11 shrink-0 rounded-lg object-cover"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">{currentSong.title}</span>
              <span className="flex items-center gap-1 truncate text-xs text-ink-muted">
                {currentSong.artist?.stageName ?? "Artiste supprimé"}
                {currentSong.artist?.verified && <BadgeCheck size={12} className="shrink-0 text-verified" />}
              </span>
            </span>
          </button>

          <div className="flex shrink-0 items-center gap-2.5">
            <button
              onClick={handleToggleLike}
              aria-label={liked ? "Ne plus aimer" : "J'aime"}
              className={`shrink-0 transition-colors ${liked ? "text-accent" : "text-ink-muted"}`}
            >
              <Heart size={19} fill={liked ? "currentColor" : "none"} />
            </button>
            <button
              onClick={handleToggleOffline}
              disabled={offlineState === "saving"}
              aria-label={offlineState === "saved" ? "Retirer du hors-ligne" : "Télécharger"}
              className={`shrink-0 transition-colors ${offlineState === "saved" ? "text-accent" : "text-ink-muted"}`}
            >
              <OfflineIcon size={19} className={offlineState === "saving" ? "animate-spin" : ""} />
            </button>
            <button onClick={playNext} aria-label="Suivant" className="shrink-0 text-ink">
              <SkipForward size={21} fill="currentColor" />
            </button>
            <button
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause" : "Lecture"}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-base transition-colors hover:bg-accent-hover"
            >
              {isPlaying ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" className="ml-0.5" />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 pb-2 pt-1.5">
          <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-ink-muted">{formatTime(progress)}</span>
          <SeekBar progress={progress} duration={currentSong.duration} onSeek={seek} variant="pill" className="min-w-0 flex-1" />
          <span className="w-8 shrink-0 text-[10px] tabular-nums text-ink-muted">{formatTime(currentSong.duration)}</span>
        </div>
      </div>

      {/* ---------- DESKTOP : 3 colonnes ---------- */}
      <div className="hidden h-[74px] items-center gap-4 px-4 md:flex lg:px-6">
        {/* Colonne 1 — piste en cours */}
        <div className="flex min-w-0 items-center gap-3 md:w-[26%] lg:w-[30%]">
          <button
            onClick={openFullPlayer}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenuPosition({ x: e.clientX, y: e.clientY });
            }}
            title="Ouvrir le lecteur"
            className="flex min-w-0 items-center gap-3 text-left"
          >
            <SafeImage
              src={currentSong.coverUrl}
              alt={currentSong.title}
              width={52}
              height={52}
              className="h-[52px] w-[52px] shrink-0 rounded-lg object-cover shadow-sm"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold leading-tight text-ink">{currentSong.title}</span>
              <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-muted">
                <span className="truncate">{currentSong.artist?.stageName ?? "Artiste supprimé"}</span>
                {currentSong.artist?.verified && <BadgeCheck size={12} className="shrink-0 text-verified" />}
              </span>
              {/* Qualité audio : reflète le réglage hors-ligne courant.
                  Masqué sous xl pour ne pas tasser la colonne. */}
              <span className="mt-1 hidden items-center gap-1 xl:flex">
                <span className="rounded bg-base px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-ink-muted">
                  MP3
                </span>
                <span className="rounded bg-base px-1.5 py-px text-[9px] font-medium text-ink-muted">{bitrate}</span>
                <span className="rounded bg-base px-1.5 py-px text-[9px] font-medium text-ink-muted">44.1 kHz</span>
              </span>
            </span>
          </button>

          <button
            onClick={handleToggleLike}
            title={liked ? "Ne plus aimer" : "J'aime"}
            aria-label={liked ? "Ne plus aimer" : "J'aime"}
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors ${
              liked ? "text-accent hover:bg-accent/10" : "text-ink-muted hover:bg-base hover:text-ink"
            }`}
          >
            <Heart size={17} fill={liked ? "currentColor" : "none"} />
          </button>
        </div>

        {/* Colonne 2 — transport + progression (centrée, largeur fluide) */}
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleShuffle}
              title="Lecture aléatoire"
              aria-label="Lecture aléatoire"
              aria-pressed={isShuffled}
              className={`transition-colors ${isShuffled ? "text-accent" : "text-ink-muted hover:text-ink"}`}
            >
              <Shuffle size={16} />
            </button>
            <button
              onClick={playPrevious}
              title="Précédent"
              aria-label="Précédent"
              className="text-ink transition-colors hover:text-accent"
            >
              <SkipBack size={19} fill="currentColor" />
            </button>
            <button
              onClick={togglePlay}
              title={isPlaying ? "Pause" : "Lecture"}
              aria-label={isPlaying ? "Pause" : "Lecture"}
              className="grid h-9 w-9 place-items-center rounded-full bg-ink text-base transition-transform hover:scale-105 active:scale-95"
            >
              {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
            </button>
            <button
              onClick={playNext}
              title="Suivant"
              aria-label="Suivant"
              className="text-ink transition-colors hover:text-accent"
            >
              <SkipForward size={19} fill="currentColor" />
            </button>
            <button
              onClick={cycleRepeatMode}
              title={repeatMode === "one" ? "Répéter le titre" : repeatMode === "all" ? "Répéter la file" : "Répéter"}
              aria-label="Répéter"
              aria-pressed={repeatMode !== "off"}
              className={`transition-colors ${repeatMode !== "off" ? "text-accent" : "text-ink-muted hover:text-ink"}`}
            >
              <RepeatIcon size={16} />
            </button>
          </div>

          <div className="flex w-full items-center gap-2">
            <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-ink-muted">{formatTime(progress)}</span>
            <SeekBar progress={progress} duration={currentSong.duration} onSeek={seek} variant="pill" className="min-w-0 flex-1" />
            <span className="w-9 shrink-0 text-[10px] tabular-nums text-ink-muted">{formatTime(currentSong.duration)}</span>
          </div>
        </div>

        {/* Colonne 3 — actions + volume */}
        <div className="flex shrink-0 items-center justify-end gap-0.5 md:w-[26%] lg:w-[30%]">
          <IconAction icon={ListMusic} label="File d'attente" badge={queue.length} onClick={openFullPlayer} />
          <IconAction icon={ListPlus} label="Ajouter à une playlist" onClick={() => setShowAddToPlaylist(true)} />
          <IconAction
            icon={OfflineIcon}
            label={offlineState === "saved" ? "Retirer du hors-ligne" : "Écouter hors-ligne"}
            active={offlineState === "saved"}
            disabled={offlineState === "saving"}
            onClick={handleToggleOffline}
          />
          <IconAction icon={Share2} label="Partager" onClick={handleShare} />
          <IconAction icon={MoreHorizontal} label="Plus d'options" onClick={openMenuFromButton} />

          <div className="mx-1.5 h-5 w-px shrink-0 bg-border" />

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => setVolume(volume > 0 ? 0 : 1)}
              title={volume === 0 ? "Réactiver le son" : "Couper le son"}
              aria-label={volume === 0 ? "Réactiver le son" : "Couper le son"}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-base hover:text-ink"
            >
              <VolumeIcon size={17} />
            </button>
            {/* Largeur portée par ce conteneur, pas par SeekBar : SeekBar
                applique `w-full` en dur, une classe de largeur passée en
                `className` entrerait en conflit avec. Masqué sous lg où la
                colonne est trop étroite — le bouton muet reste disponible. */}
            <div className="hidden w-20 lg:block">
              <SeekBar progress={volume} duration={1} onSeek={setVolume} variant="pill" />
            </div>
          </div>

          <IconAction icon={Maximize2} label="Lecteur plein écran" onClick={openFullPlayer} />
        </div>
      </div>

      {menuPosition && (
        <SongContextMenu song={currentSong} position={menuPosition} hideOffline onClose={() => setMenuPosition(null)} />
      )}
      {showAddToPlaylist && (
        <AddToPlaylistModal songId={currentSong._id} onClose={() => setShowAddToPlaylist(false)} />
      )}
      {showShareModal && (
        <ShareModal
          subject={buildSongSubject(currentSong)}
          onClose={() => setShowShareModal(false)}
          onOpenAddToPlaylist={() => setShowAddToPlaylist(true)}
        />
      )}
    </div>
  );
}
