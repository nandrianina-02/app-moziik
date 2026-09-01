"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  BadgeCheck,
  Heart,
  Share2,
  ListPlus,
  Mic2,
  Disc3,
  MoreHorizontal,
  DownloadCloud,
  Loader2,
  Clapperboard,
} from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { VideoPlayerModal } from "@/components/song/VideoPlayerModal";
import { useDominantColor } from "@/components/song/useDominantColor";
import { formatCompactNumber } from "@/lib/formatNumber";
import type { SongDetail, AlbumSummary } from "@/components/song/types";
import { libelleTypeAlbum } from "@/lib/albums";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SongHero({
  song,
  album,
  commentsCount,
  isCurrent,
  isPlaying,
  liked,
  offline,
  offlineBusy,
  onTogglePlay,
  onToggleLike,
  onToggleOffline,
  onShare,
  onAddToQueue,
  onAddToPlaylist,
  onOpenMore,
}: {
  song: SongDetail;
  album: AlbumSummary | null;
  commentsCount: number;
  isCurrent: boolean;
  isPlaying: boolean;
  liked: boolean;
  offline: boolean;
  offlineBusy: boolean;
  onTogglePlay: () => void;
  onToggleLike: () => void;
  onToggleOffline: () => void;
  onShare: () => void;
  onAddToQueue: () => void;
  onAddToPlaylist: () => void;
  onOpenMore: (x: number, y: number) => void;
}) {
  const color = useDominantColor(song.coverUrl);
  const [clipOuvert, setClipOuvert] = useState(false);
  const gradient = color
    ? `radial-gradient(120% 120% at 15% 0%, rgba(${color.r}, ${color.g}, ${color.b}, 0.35), transparent 60%)`
    : "radial-gradient(120% 120% at 15% 0%, rgba(255, 107, 74, 0.18), transparent 60%)";

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    onOpenMore(e.clientX, e.clientY);
  }

  return (
    <div className="relative overflow-hidden rounded-xl2 border border-border">
      <div
        className="absolute inset-0 -z-10 bg-surface"
        style={{ backgroundImage: gradient }}
      />
      <div className="absolute inset-0 -z-10 backdrop-blur-3xl" />

      <div className="flex flex-col gap-6 p-5 sm:p-8 md:flex-row md:items-end">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          onContextMenu={handleContextMenu}
          className="group relative mx-auto w-48 shrink-0 sm:w-56 md:mx-0"
        >
          <SafeImage
            src={song.coverUrl}
            alt={song.title}
            width={320}
            height={320}
            priority
            className="aspect-square w-full rounded-xl2 object-cover shadow-2xl shadow-black/30"
          />
          <button
            onClick={onTogglePlay}
            aria-label={isCurrent && isPlaying ? "Mettre en pause" : "Écouter"}
            className="absolute inset-0 grid place-items-center rounded-xl2 bg-black/0 transition-all group-hover:bg-black/30 au-survol"
          >
            <span className="grid h-14 w-14 place-items-center rounded-full bg-accent text-base shadow-lg transition-transform hover:scale-105">
              {isCurrent && isPlaying ? (
                <Pause size={22} fill="currentColor" />
              ) : (
                <Play size={22} fill="currentColor" className="ml-0.5" />
              )}
            </span>
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05, ease: "easeOut" }}
          className="min-w-0 flex-1 text-center md:text-left"
        >
          <div className="mb-2 flex flex-wrap items-center justify-center gap-2 md:justify-start">
            <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-medium text-accent">
              {album
                ? libelleTypeAlbum(album.type)
                : "Single"}
            </span>
            {song.explicit && (
              <span className="rounded-full bg-ink-muted/15 px-2.5 py-1 text-[11px] font-medium text-ink-muted">
                Explicite
              </span>
            )}
          </div>

          <h1 className="flex flex-wrap items-center justify-center gap-2 text-2xl font-display leading-tight sm:text-3xl md:justify-start">
            {song.title}
            {song.artist?.verified && (
              <BadgeCheck size={22} className="text-verified" />
            )}
          </h1>

          {song.artist && (
            <Link
              href={`/artiste/${song.artist._id}`}
              className="mt-2 inline-flex items-center gap-2 text-sm text-ink-muted transition-colors hover:text-ink"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-surface text-[10px] font-medium">
                {song.artist.stageName.charAt(0).toUpperCase()}
              </span>
              {song.artist.stageName}
            </Link>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 md:justify-start">
            {song.genre && (
              <span className="rounded-full border border-border px-2.5 py-1 text-xs text-ink-muted">
                {song.genre}
              </span>
            )}
            {song.releaseDate && (
              <span className="rounded-full border border-border px-2.5 py-1 text-xs text-ink-muted">
                {new Date(song.releaseDate).getFullYear()}
              </span>
            )}
            <span className="rounded-full border border-border px-2.5 py-1 text-xs text-ink-muted">
              {formatDuration(song.duration)}
            </span>
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-2 md:justify-start">
            <StatPill label="Écoutes" value={song.playsCount ?? 0} />
            <StatPill label="Favoris" value={song.likesCount ?? 0} />
            <StatPill label="Commentaires" value={commentsCount} />
            <StatPill label="Partages" value={song.sharesCount ?? 0} />
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1, ease: "easeOut" }}
        className="flex flex-wrap items-center gap-2.5 border-t border-border/70 p-4 sm:px-8"
      >
        <button
          onClick={onTogglePlay}
          className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
        >
          {isCurrent && isPlaying ? (
            <Pause size={16} fill="currentColor" />
          ) : (
            <Play size={16} fill="currentColor" />
          )}
          {isCurrent && isPlaying ? "Pause" : "Écouter"}
        </button>

        <ActionButton
          icon={Heart}
          label={liked ? "Favori" : "Favoris"}
          active={liked}
          fillWhenActive
          onClick={onToggleLike}
        />
        <ActionButton
          icon={offlineBusy ? Loader2 : DownloadCloud}
          iconClassName={offlineBusy ? "animate-spin" : undefined}
          label={offline ? "Téléchargé" : "Télécharger"}
          active={offline}
          onClick={onToggleOffline}
        />
        {song.videoUrl && (
          <ActionButton icon={Clapperboard} label="Regarder le clip" onClick={() => setClipOuvert(true)} />
        )}
        <ActionButton icon={Share2} label="Partager" onClick={onShare} />
        <ActionButton
          icon={ListPlus}
          label="Ajouter à une playlist"
          onClick={onAddToPlaylist}
        />
        <ActionButton
          icon={ListPlus}
          label="File d'attente"
          onClick={onAddToQueue}
        />
        {song.artist && (
          <Link
            href={`/artiste/${song.artist._id}`}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-ink"
          >
            <Mic2 size={14} /> Artiste
          </Link>
        )}
        {album && (
          <Link
            href={`/album/${album._id}`}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-ink"
          >
            <Disc3 size={14} /> Album
          </Link>
        )}

        <button
          onClick={(e) => onOpenMore(e.clientX, e.clientY)}
          aria-label="Plus d'actions"
          className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border text-ink-muted transition-colors hover:border-accent hover:text-ink"
        >
          <MoreHorizontal size={16} />
        </button>
      </motion.div>

      {clipOuvert && song.videoUrl && (
        <VideoPlayerModal
          videoUrl={song.videoUrl}
          titre={song.title}
          sousTitre={song.artist?.stageName}
          onClose={() => setClipOuvert(false)}
        />
      )}
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-lg bg-surface px-3 py-1.5 text-center text-xs">
      <span className="block text-sm font-semibold leading-tight">
        {formatCompactNumber(value)}
      </span>
      <span className="text-[10px] text-ink-muted">{label}</span>
    </span>
  );
}

function ActionButton({
  icon: Icon,
  iconClassName,
  label,
  active,
  fillWhenActive,
  onClick,
}: {
  icon: typeof Heart;
  iconClassName?: string;
  label: string;
  active?: boolean;
  fillWhenActive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-medium transition-colors ${
        active
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-border text-ink-muted hover:border-accent hover:text-ink"
      }`}
    >
      <Icon
        size={14}
        className={iconClassName}
        fill={fillWhenActive && active ? "currentColor" : "none"}
      />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
