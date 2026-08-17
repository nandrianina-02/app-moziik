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
  MonitorSpeaker,
} from "lucide-react";
import { usePlayer } from "@/context/PlayerProvider";
import { useToast } from "@/context/ToastProvider";
import { useOnlineStatus } from "@/context/OnlineStatusProvider";
import { useSidebar } from "@/context/SidebarProvider";
import { useSession } from "next-auth/react";
import { SeekBar } from "@/components/player/SeekBar";
import { SongContextMenu } from "@/components/music/SongContextMenu";
import { useLongPress } from "@/components/music/useLongPress";
import { DeviceMenu } from "@/components/player/DeviceMenu";
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

/**
 * Action de la zone droite (desktop) : icône surmontant son libellé.
 * Le libellé rend chaque action identifiable sans survol — plus lisible
 * qu'une rangée d'icônes seules pour des fonctions peu fréquentes
 * (file d'attente, partage, téléchargement).
 */
function LabelledAction({
  icon: Icon,
  label,
  active,
  disabled,
  badge,
  spin,
  onClick,
}: {
  icon: typeof Play;
  label: string;
  active?: boolean;
  disabled?: boolean;
  badge?: number;
  spin?: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`group flex w-[62px] shrink-0 flex-col items-center gap-1 rounded-lg py-1 transition-colors disabled:opacity-50 ${
        active ? "text-accent" : "text-ink-muted hover:text-ink"
      }`}
    >
      <span className="relative inline-flex">
        <Icon size={19} className={spin ? "animate-spin" : ""} />
        {badge !== undefined && badge > 0 && (
          <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-semibold leading-none text-base">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  );
}

/** Même action, en icône seule : utilisé sous `lg`, où les libellés ne tiennent pas. */
function CompactAction({
  icon: Icon,
  label,
  active,
  disabled,
  badge,
  spin,
  onClick,
}: {
  icon: typeof Play;
  label: string;
  active?: boolean;
  disabled?: boolean;
  badge?: number;
  spin?: boolean;
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
      <Icon size={18} className={spin ? "animate-spin" : ""} />
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
    outputDeviceId,
    outputSwitchSupported,
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
  const [devicePosition, setDevicePosition] = useState<{ x: number; y: number } | null>(null);
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

  // Ancre les menus au bouton plutôt qu'au curseur : le lecteur est collé
  // en bas de l'écran, un menu ancré au clic sortirait du cadre visible.
  // ContextMenuShell le recale ensuite au-dessus du bouton.
  function anchorToButton(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: rect.left, y: rect.top };
  }

  return (
    <div
      className={`fixed bottom-16 left-0 right-0 z-30 transition-[left] duration-300 ease-out md:bottom-0 md:px-4 md:pb-4 print:hidden ${
        // Décalage exact sur la largeur de la sidebar pour que le lecteur
        // reste dans la zone de contenu et ne passe jamais dessous.
        collapsed ? "md:left-20" : "md:left-64"
      }`}
    >
      {/* Carte flottante sur desktop (bords arrondis + ombre portée),
          barre pleine largeur collée au bas sur mobile où l'espace
          horizontal est trop précieux pour des marges. */}
      <div className="border-t border-border bg-surface/95 backdrop-blur-md shadow-[0_-8px_32px_-16px_rgba(0,0,0,0.35)] md:rounded-2xl md:border md:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.3)]">
      {/* ---------- COMPACT : mobile et tablette ----------
          Jusqu'à `lg`, la sidebar occupe déjà 256 px : à 768 px il ne
          reste que 480 px au lecteur. La disposition en trois colonnes y
          réduisait le titre du morceau à 4 px de large. Cette disposition
          compacte s'y tient sans rien tronquer ; les commandes secondaires
          (aléatoire, répétition, volume) restent accessibles dans le
          lecteur plein écran, à un appui sur la pochette. */}
      <div className="lg:hidden">
        <div className="flex items-center gap-3 px-3 pt-2.5 sm:gap-4 sm:px-4">
          <button
            onClick={openFullPlayer}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenuPosition({ x: e.clientX, y: e.clientY });
            }}
            onTouchStart={longPress.onTouchStart}
            onTouchEnd={longPress.onTouchEnd}
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

          {/* Les commandes secondaires n'apparaissent qu'une fois la place
              disponible : à 320 px, seuls « suivant » et « lecture »
              tiennent à côté du titre sans le comprimer. */}
          <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
            <button
              onClick={handleToggleLike}
              aria-label={liked ? "Ne plus aimer" : "J'aime"}
              className={`hidden shrink-0 transition-colors xs:block ${liked ? "text-accent" : "text-ink-muted"}`}
            >
              <Heart size={19} fill={liked ? "currentColor" : "none"} />
            </button>
            <button
              onClick={handleToggleOffline}
              disabled={offlineState === "saving"}
              aria-label={offlineState === "saved" ? "Retirer du hors-ligne" : "Télécharger"}
              className={`hidden shrink-0 transition-colors sm:block ${offlineState === "saved" ? "text-accent" : "text-ink-muted"}`}
            >
              <OfflineIcon size={19} className={offlineState === "saving" ? "animate-spin" : ""} />
            </button>
            {/* « Précédent » dès 360 px : c'est une commande de transport,
                elle prime sur le téléchargement, qui attend 640 px. */}
            <button
              onClick={playPrevious}
              aria-label="Précédent"
              className="hidden shrink-0 text-ink xs:block"
            >
              <SkipBack size={21} fill="currentColor" />
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
            <button
              onClick={openFullPlayer}
              aria-label="Lecteur plein écran"
              className="hidden h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-base hover:text-ink md:grid"
            >
              <Maximize2 size={17} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 pb-2 pt-1.5 sm:px-4">
          <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-ink-muted">{formatTime(progress)}</span>
          <SeekBar progress={progress} duration={currentSong.duration} onSeek={seek} variant="pill" className="min-w-0 flex-1" />
          <span className="w-8 shrink-0 text-[10px] tabular-nums text-ink-muted">{formatTime(currentSong.duration)}</span>
        </div>
      </div>

      {/* ---------- BUREAU : 3 colonnes, à partir de lg ----------
          Aucune colonne n'a de largeur en pourcentage. Les pourcentages
          étaient la cause des chevauchements : la colonne d'actions a une
          largeur minimale imposée par ses boutons (plus de 500 px avec les
          libellés), donc `w-34%` ne la contenait qu'au-delà de ~1900 px —
          en dessous, son contenu débordait par-dessus la colonne centrale
          et écrasait la barre de progression. Elle se dimensionne
          désormais sur son contenu (`shrink-0`, largeur automatique), et
          les deux autres se partagent ce qui reste. */}
      <div className="hidden h-[86px] items-center gap-4 px-4 lg:flex xl:gap-6 xl:px-6">
        {/* Colonne 1 — piste en cours. Tronque au lieu d'imposer sa largeur,
            mais garde un plancher : sans lui, le titre tombait à 44 px de
            large à 1280, illisible. */}
        <div className="flex min-w-[11rem] flex-1 items-center gap-3 xl:max-w-[24rem]">
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
              <span className="mt-1.5 hidden items-center gap-1 xl:flex">
                <span className="rounded-md bg-base px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-muted">
                  MP3
                </span>
                <span className="rounded-md bg-base px-1.5 py-0.5 text-[9px] font-semibold text-ink-muted">{bitrate}</span>
                <span className="rounded-md bg-base px-1.5 py-0.5 text-[9px] font-semibold text-ink-muted">44.1 kHz</span>
              </span>
            </span>
          </button>

          {/* Ces 48 px sont pris au titre du morceau : on ne les réclame
              qu'à partir de 2xl, avec les actions libellées. En dessous,
              « J'aime » reste accessible par « Plus d'options » (voir
              SongContextMenu) — et sur la barre compacte, sous lg. */}
          <button
            onClick={handleToggleLike}
            title={liked ? "Ne plus aimer" : "J'aime"}
            aria-label={liked ? "Ne plus aimer" : "J'aime"}
            className={`hidden h-9 w-9 shrink-0 place-items-center rounded-full transition-all hover:scale-110 2xl:grid ${
              liked ? "text-accent" : "text-ink-muted hover:text-accent"
            }`}
          >
            <Heart size={20} fill={liked ? "currentColor" : "none"} />
          </button>
        </div>

        <div className="hidden h-11 w-px shrink-0 bg-border xl:block" />

        {/* Colonne 2 — transport + progression. `flex-[2]` : elle reçoit
            deux fois la part de la colonne 1 sur l'espace laissé libre par
            la colonne d'actions, et ne descend jamais sous la largeur de
            ses boutons de transport. */}
        <div className="flex min-w-[15rem] flex-[2] flex-col items-center justify-center gap-1.5 2xl:max-w-[44rem]">
          <div className="flex items-center gap-4 xl:gap-5">
            <button
              onClick={toggleShuffle}
              title="Lecture aléatoire"
              aria-label="Lecture aléatoire"
              aria-pressed={isShuffled}
              className={`transition-colors ${isShuffled ? "text-accent" : "text-ink-muted hover:text-ink"}`}
            >
              <Shuffle size={17} />
            </button>
            <button
              onClick={playPrevious}
              title="Précédent"
              aria-label="Précédent"
              className="text-ink transition-colors hover:text-accent"
            >
              <SkipBack size={21} fill="currentColor" />
            </button>
            <button
              onClick={togglePlay}
              title={isPlaying ? "Pause" : "Lecture"}
              aria-label={isPlaying ? "Pause" : "Lecture"}
              className="grid h-12 w-12 place-items-center rounded-full bg-accent text-base shadow-lg shadow-accent/25 transition-transform hover:scale-105 active:scale-95"
            >
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
            </button>
            <button
              onClick={playNext}
              title="Suivant"
              aria-label="Suivant"
              className="text-ink transition-colors hover:text-accent"
            >
              <SkipForward size={21} fill="currentColor" />
            </button>
            <button
              onClick={cycleRepeatMode}
              title={repeatMode === "one" ? "Répéter le titre" : repeatMode === "all" ? "Répéter la file" : "Répéter"}
              aria-label="Répéter"
              aria-pressed={repeatMode !== "off"}
              className={`transition-colors ${repeatMode !== "off" ? "text-accent" : "text-ink-muted hover:text-ink"}`}
            >
              <RepeatIcon size={17} />
            </button>
          </div>

          <div className="flex w-full items-center gap-2.5">
            <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-ink-muted">{formatTime(progress)}</span>
            <SeekBar progress={progress} duration={currentSong.duration} onSeek={seek} variant="pill" className="min-w-0 flex-1" />
            <span className="w-9 shrink-0 text-[11px] tabular-nums text-ink-muted">{formatTime(currentSong.duration)}</span>
          </div>
        </div>

        <div className="hidden h-11 w-px shrink-0 bg-border xl:block" />

        {/* Colonne 3 — actions + volume. Largeur automatique : elle prend
            exactement ce que ses boutons demandent, jamais plus. */}
        <div className="flex shrink-0 items-center justify-end gap-1">
          {/* Les cinq libellés font à eux seuls plus de 310 px : ils ne
              tiennent qu'à partir de 2xl. En dessous, mêmes actions en
              icônes seules (libellé au survol). */}
          <div className="hidden items-center gap-0.5 2xl:flex">
            <LabelledAction icon={ListMusic} label="File d'attente" badge={queue.length} onClick={openFullPlayer} />
            <LabelledAction icon={ListPlus} label="Ajouter" onClick={() => setShowAddToPlaylist(true)} />
            <LabelledAction
              icon={OfflineIcon}
              label={offlineState === "saved" ? "Hors-ligne" : "Télécharger"}
              active={offlineState === "saved"}
              disabled={offlineState === "saving"}
              spin={offlineState === "saving"}
              onClick={handleToggleOffline}
            />
            <LabelledAction icon={Share2} label="Partager" onClick={handleShare} />
            <LabelledAction icon={MoreHorizontal} label="Plus" onClick={(e) => setMenuPosition(anchorToButton(e))} />
          </div>

          <div className="flex items-center gap-0.5 2xl:hidden">
            <CompactAction icon={ListMusic} label="File d'attente" badge={queue.length} onClick={openFullPlayer} />
            {/* Ajouter, télécharger et partager restent joignables par
                « Plus d'options » : on ne les répète ici qu'une fois la
                largeur disponible. */}
            <span className="hidden items-center gap-0.5 xl:flex">
              <CompactAction icon={ListPlus} label="Ajouter à une playlist" onClick={() => setShowAddToPlaylist(true)} />
              <CompactAction
                icon={OfflineIcon}
                label={offlineState === "saved" ? "Retirer du hors-ligne" : "Écouter hors-ligne"}
                active={offlineState === "saved"}
                disabled={offlineState === "saving"}
                spin={offlineState === "saving"}
                onClick={handleToggleOffline}
              />
              <CompactAction icon={Share2} label="Partager" onClick={handleShare} />
            </span>
            <CompactAction icon={MoreHorizontal} label="Plus d'options" onClick={(e) => setMenuPosition(anchorToButton(e))} />
          </div>

          <div className="mx-1 hidden h-9 w-px shrink-0 bg-border xl:block" />

          {/* Sélecteur de sortie audio. Masqué — plutôt qu'affiché inerte —
              là où l'API n'existe pas : seuls Chrome/Edge 110+ savent
              rediriger un AudioContext (Firefox et Safari, non). Voir
              types/audio-output.d.ts. En icône seule à toutes les tailles :
              c'est un réglage occasionnel, et il se lit naturellement à
              côté du volume, comme sur les lecteurs de bureau. */}
          {outputSwitchSupported && (
            <button
              onClick={(e) => setDevicePosition(anchorToButton(e))}
              title="Appareils — choisir la sortie audio"
              aria-label="Appareils — choisir la sortie audio"
              aria-haspopup="menu"
              aria-expanded={devicePosition !== null}
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors ${
                // Accentué dès qu'on n'est plus sur la sortie système, pour
                // que le son "qui sort ailleurs" ne soit jamais une surprise.
                outputDeviceId && outputDeviceId !== "default"
                  ? "text-accent hover:bg-accent/10"
                  : "text-ink-muted hover:bg-base hover:text-ink"
              }`}
            >
              <MonitorSpeaker size={17} />
            </button>
          )}

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => setVolume(volume > 0 ? 0 : 1)}
              title={volume === 0 ? "Réactiver le son" : "Couper le son"}
              aria-label={volume === 0 ? "Réactiver le son" : "Couper le son"}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-base hover:text-ink"
            >
              <VolumeIcon size={18} />
            </button>
            {/* Largeur portée par ce conteneur, pas par SeekBar : SeekBar
                applique `w-full` en dur, une classe de largeur passée en
                `className` entrerait en conflit avec. Ces 80 px sont pris
                à la barre de progression : on ne les réclame qu'à partir
                de xl, où elle reste confortable. Le bouton muet, lui,
                reste disponible partout. */}
            <div className="hidden w-20 xl:block">
              <SeekBar progress={volume} duration={1} onSeek={setVolume} variant="pill" />
            </div>
          </div>

          <button
            onClick={openFullPlayer}
            title="Lecteur plein écran"
            aria-label="Lecteur plein écran"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-base hover:text-ink"
          >
            <Maximize2 size={17} />
          </button>
        </div>
      </div>
      </div>

      {menuPosition && (
        <SongContextMenu song={currentSong} position={menuPosition} hideOffline onClose={() => setMenuPosition(null)} />
      )}
      {devicePosition && <DeviceMenu anchor={devicePosition} onClose={() => setDevicePosition(null)} />}
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
