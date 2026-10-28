"use client";

import Link from "next/link";
import {
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
import { EnteteMedia, Point, BoutonLectureMedia, BoutonActionMedia } from "@/components/music/EnteteMedia";
import { formatCompactNumber } from "@/lib/formatNumber";
import type { AlbumDetail } from "@/components/album/types";
import { ALBUM_TYPES, libelleTypeAlbum, motPiste, type AlbumType } from "@/lib/albums";


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
  onChangeType,
}: {
  album: AlbumDetail;
  /** Change la forme de la publication (album, EP, single, podcast). */
  onChangeType?: (type: AlbumType) => void;
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
  const annee = new Date(album.releaseDate).getFullYear();

  return (
    <EnteteMedia
      fond={{ couleurDe: album.bannerUrl || album.coverUrl, banniere: album.bannerUrl }}
      coinHaut={
        canManage && (
          <>
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
                editMode ? "bg-accent text-base hover:bg-accent-hover" : "bg-black/60 text-white hover:bg-black/70"
              }`}
            >
              {editMode ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
              Mode édition
            </button>
          </>
        )
      }
      pochette={
        <div className="relative">
          <SafeImage src={album.coverUrl} alt={album.title} width={320} height={320} priority className="aspect-square w-full rounded-md object-cover" />
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
        </div>
      }
      etiquette={
        // La forme se change ici, en mode édition : c'est ce qui transforme
        // un album existant en podcast, sans repasser par la base.
        editMode && canManage ? (
          <label className="inline-flex items-center gap-2">
            <span className="sr-only">Forme de la publication</span>
            <select
              value={album.type}
              onChange={(e) => onChangeType?.(e.target.value as AlbumType)}
              className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent outline-none"
            >
              {ALBUM_TYPES.map((valeur) => (
                <option key={valeur} value={valeur}>
                  {libelleTypeAlbum(valeur)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          libelleTypeAlbum(album.type)
        )
      }
      titre={album.title}
      infos={
        <>
          {album.artist ? (
            <Link href={`/artiste/${album.artist._id}`} className="inline-flex items-center gap-1 font-semibold text-ink hover:underline">
              {album.artist.stageName}
              {album.artist.verified && <BadgeCheck size={14} className="text-verified" />}
            </Link>
          ) : (
            <span className="italic text-accent">Artiste supprimé</span>
          )}
          <Point />
          <span>{annee}</span>
          <Point />
          <span>
            {album.songs.length} {motPiste(album.type, album.songs.length)}
          </span>
          <Point />
          <span>{formatCompactNumber(totalPlays)} écoutes</span>
          <Point />
          <span>{formatCompactNumber(totalLikes)} j&apos;aime</span>
        </>
      }
    >
      {album.songs.length > 0 && (
        <BoutonLectureMedia enCours={isCurrentAlbumPlaying} onClick={onTogglePlayAll} libelle={album.title} />
      )}
      <BoutonActionMedia libelle={saved ? "Retirer de la bibliothèque" : "Ajouter à la bibliothèque"} onClick={onToggleSaved} actif={saved} disabled={savingToggle}>
        <Bookmark size={22} fill={saved ? "currentColor" : "none"} />
      </BoutonActionMedia>
      <BoutonActionMedia libelle="Télécharger pour l'écoute hors connexion" onClick={onDownloadAll} disabled={downloading}>
        {downloading ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            {downloadProgress.total > 0 && `${downloadProgress.done}/${downloadProgress.total}`}
          </>
        ) : (
          <DownloadCloud size={22} />
        )}
      </BoutonActionMedia>
      <BoutonActionMedia libelle="Partager" onClick={onShare}>
        <Share2 size={20} />
      </BoutonActionMedia>
      <BoutonActionMedia libelle="Plus d'options" onClick={(e) => onOpenMore(e.clientX, e.clientY)}>
        <MoreHorizontal size={22} />
      </BoutonActionMedia>
    </EnteteMedia>
  );
}
