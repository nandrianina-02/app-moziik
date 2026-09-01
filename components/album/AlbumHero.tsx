"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  BadgeCheck,
  Bookmark,
  Share2,
  DownloadCloud,
  MoreHorizontal,
  Loader2,
  Pencil,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { useDominantColor } from "@/components/song/useDominantColor";
import { formatCompactNumber } from "@/lib/formatNumber";
import type { AlbumDetail } from "@/components/album/types";
import { libelleTypeAlbum, motPiste } from "@/lib/albums";


export function AlbumHero({
  album,
  totalPlays,
  totalLikes,
  isCurrentAlbumPlaying,
  saved,
  savingToggle,
  downloading,
  downloadProgress,
  canManage,
  editMode,
  onTogglePlayAll,
  onToggleSaved,
  onDownloadAll,
  onShare,
  onOpenMore,
  onToggleEditMode,
  onEditBanner,
  onEditCover,
}: {
  album: AlbumDetail;
  totalPlays: number;
  totalLikes: number;
  isCurrentAlbumPlaying: boolean;
  saved: boolean;
  savingToggle: boolean;
  downloading: boolean;
  downloadProgress: { done: number; total: number };
  canManage: boolean;
  editMode: boolean;
  onTogglePlayAll: () => void;
  onToggleSaved: () => void;
  onDownloadAll: () => void;
  onShare: () => void;
  onOpenMore: (x: number, y: number) => void;
  onToggleEditMode: () => void;
  onEditBanner: () => void;
  onEditCover: () => void;
}) {
  const color = useDominantColor(album.bannerUrl || album.coverUrl);
  const gradient = color
    ? `linear-gradient(180deg, rgba(${color.r}, ${color.g}, ${color.b}, 0.55) 0%, rgba(${color.r}, ${color.g}, ${color.b}, 0.15) 55%, transparent 100%)`
    : "linear-gradient(180deg, rgba(255, 107, 74, 0.35) 0%, rgba(255, 107, 74, 0.08) 55%, transparent 100%)";

  return (
    <div className="relative overflow-hidden rounded-xl2 border border-border">
      {/* Bannière immersive */}
      <div className="relative h-40 w-full sm:h-56 md:h-72">
        {album.bannerUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${album.bannerUrl})` }}
          />
        ) : (
          <div className="absolute inset-0 bg-surface" />
        )}
        <div className="absolute inset-0" style={{ backgroundImage: gradient }} />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/10 to-transparent" />

        {canManage && (
          <div className="absolute right-3 top-3 flex items-center gap-2">
            {editMode && (
              <button
                onClick={onEditBanner}
                className="flex items-center gap-1.5 rounded-full bg-black/60 px-3.5 py-2 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-black/70"
              >
                <Pencil size={13} /> Modifier la bannière
              </button>
            )}
            <button
              onClick={onToggleEditMode}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium backdrop-blur transition-colors ${
                editMode
                  ? "bg-accent text-base hover:bg-accent-hover"
                  : "bg-black/60 text-white hover:bg-black/70"
              }`}
            >
              {editMode ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
              Mode édition
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6 px-5 pb-6 sm:px-8 md:flex-row md:items-end md:pb-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="group relative -mt-16 mx-auto w-36 shrink-0 sm:-mt-20 sm:w-44 md:mx-0 md:-mt-24 md:w-52"
        >
          <SafeImage
            src={album.coverUrl}
            alt={album.title}
            width={320}
            height={320}
            priority
            className="aspect-square w-full rounded-xl2 object-cover shadow-2xl shadow-black/30 ring-4 ring-surface"
          />
          {album.songs.length > 0 && (
            <button
              onClick={onTogglePlayAll}
              aria-label={isCurrentAlbumPlaying ? "Mettre en pause" : "Tout écouter"}
              className="absolute inset-0 grid place-items-center rounded-xl2 bg-black/0 transition-all group-hover:bg-black/30 au-survol"
            >
              <span className="grid h-14 w-14 place-items-center rounded-full bg-accent text-base shadow-lg transition-transform hover:scale-105">
                {isCurrentAlbumPlaying ? (
                  <Pause size={22} fill="currentColor" />
                ) : (
                  <Play size={22} fill="currentColor" className="ml-0.5" />
                )}
              </span>
            </button>
          )}
          {canManage && editMode && (
            <button
              onClick={onEditCover}
              aria-label="Modifier la photo"
              title="Modifier la photo"
              className="absolute -bottom-2 -right-2 grid h-9 w-9 place-items-center rounded-full bg-surface text-ink shadow-lg ring-1 ring-border transition-colors hover:text-accent"
            >
              <Pencil size={15} />
            </button>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05, ease: "easeOut" }}
          className="min-w-0 flex-1 text-center md:text-left"
        >
          <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-medium text-accent">
            {libelleTypeAlbum(album.type)}
          </span>

          <h1 className="mt-2 text-2xl font-display leading-tight sm:text-3xl">{album.title}</h1>

          {album.artist ? (
            <Link
              href={`/artiste/${album.artist._id}`}
              className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
            >
              {album.artist.stageName}
              {album.artist.verified && <BadgeCheck size={14} className="text-verified" />}
            </Link>
          ) : (
            <p className="mt-1.5 text-sm italic text-accent">Artiste supprimé</p>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 md:justify-start">
            <span className="rounded-full border border-border px-2.5 py-1 text-xs text-ink-muted">
              {new Date(album.releaseDate).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <span className="rounded-full border border-border px-2.5 py-1 text-xs text-ink-muted">
              {album.songs.length} {motPiste(album.type, album.songs.length)}
            </span>
            <span className="rounded-full border border-border px-2.5 py-1 text-xs text-ink-muted">
              {formatCompactNumber(totalPlays)} écoutes
            </span>
            <span className="rounded-full border border-border px-2.5 py-1 text-xs text-ink-muted">
              {formatCompactNumber(totalLikes)} likes
            </span>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 md:justify-start">
            {album.songs.length > 0 && (
              <button
                onClick={onTogglePlayAll}
                className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
              >
                {isCurrentAlbumPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
                {isCurrentAlbumPlaying ? "Pause" : "Tout écouter"}
              </button>
            )}
            <button
              onClick={onToggleSaved}
              disabled={savingToggle}
              className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                saved ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-ink-muted hover:border-accent hover:text-ink"
              }`}
            >
              <Bookmark size={15} fill={saved ? "currentColor" : "none"} />
              <span className="hidden sm:inline">{saved ? "Ajouté" : "Ajouter"}</span>
            </button>
            <button
              onClick={onDownloadAll}
              disabled={downloading}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:border-accent hover:text-ink disabled:opacity-60"
            >
              {downloading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  {downloadProgress.total > 0 && `${downloadProgress.done}/${downloadProgress.total}`}
                </>
              ) : (
                <>
                  <DownloadCloud size={15} />
                  <span className="hidden sm:inline">Télécharger</span>
                </>
              )}
            </button>
            <button
              onClick={onShare}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:border-accent hover:text-ink"
            >
              <Share2 size={15} />
              <span className="hidden sm:inline">Partager</span>
            </button>
            <button
              onClick={(e) => onOpenMore(e.clientX, e.clientY)}
              aria-label="Plus d'options"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border text-ink-muted transition-colors hover:border-accent hover:text-ink"
            >
              <MoreHorizontal size={16} />
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
