"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Heart,
  Share2,
  ListPlus,
  ListEnd,
  MoreHorizontal,
  DownloadCloud,
  Loader2,
  Clapperboard,
} from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { VideoPlayerModal } from "@/components/song/VideoPlayerModal";
import { EnteteMedia, Point, BoutonLectureMedia, BoutonActionMedia } from "@/components/music/EnteteMedia";
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
  const [clipOuvert, setClipOuvert] = useState(false);

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    onOpenMore(e.clientX, e.clientY);
  }

  return (
    <>
      <EnteteMedia
        fond={{ couleurDe: song.coverUrl }}
        pochette={
          <div onContextMenu={handleContextMenu}>
            <SafeImage src={song.coverUrl} alt={song.title} width={320} height={320} priority className="aspect-square w-full rounded-md object-cover" />
          </div>
        }
        etiquette={
          <span className="inline-flex items-center gap-2">
            Titre
            {album && <span className="font-normal text-ink/70">· {libelleTypeAlbum(album.type)}</span>}
            {song.explicit && (
              <span className="rounded-sm bg-ink/20 px-1 text-[10px] font-semibold uppercase leading-4 text-ink" title="Explicite">
                E
              </span>
            )}
          </span>
        }
        titre={song.title}
        infos={
          <>
            {song.artist && (
              <Link href={`/artiste/${song.artist._id}`} className="inline-flex items-center gap-1 font-semibold text-ink hover:underline">
                {song.artist.stageName}
                {song.artist.verified && <BadgeCheck size={14} className="text-verified" />}
              </Link>
            )}
            {album && (
              <>
                <Point />
                <Link href={`/album/${album._id}`} className="hover:underline">
                  {album.title}
                </Link>
              </>
            )}
            {song.releaseDate && (
              <>
                <Point />
                <span>{new Date(song.releaseDate).getFullYear()}</span>
              </>
            )}
            <Point />
            <span>{formatDuration(song.duration)}</span>
            {song.genre && (
              <>
                <Point />
                <span>{song.genre}</span>
              </>
            )}
            <Point />
            <span>{formatCompactNumber(song.playsCount ?? 0)} écoutes</span>
            <Point />
            <span>{formatCompactNumber(song.likesCount ?? 0)} j&apos;aime</span>
            {commentsCount > 0 && (
              <>
                <Point />
                <span>
                  {formatCompactNumber(commentsCount)} commentaire{commentsCount > 1 ? "s" : ""}
                </span>
              </>
            )}
          </>
        }
      >
        <BoutonLectureMedia enCours={isCurrent && isPlaying} onClick={onTogglePlay} libelle={song.title} />
        <BoutonActionMedia libelle={liked ? "Retirer des favoris" : "Ajouter aux favoris"} onClick={onToggleLike} actif={liked}>
          <Heart size={22} fill={liked ? "currentColor" : "none"} />
        </BoutonActionMedia>
        <BoutonActionMedia libelle={offline ? "Retirer de l'écoute hors connexion" : "Télécharger pour l'écoute hors connexion"} onClick={onToggleOffline} actif={offline}>
          {offlineBusy ? <Loader2 size={20} className="animate-spin" /> : <DownloadCloud size={22} />}
        </BoutonActionMedia>
        {song.videoUrl && (
          <BoutonActionMedia libelle="Regarder le clip" onClick={() => setClipOuvert(true)}>
            <Clapperboard size={20} />
          </BoutonActionMedia>
        )}
        <BoutonActionMedia libelle="Ajouter à une playlist" onClick={onAddToPlaylist}>
          <ListPlus size={22} />
        </BoutonActionMedia>
        <BoutonActionMedia libelle="Ajouter à la file d'attente" onClick={onAddToQueue}>
          <ListEnd size={22} />
        </BoutonActionMedia>
        <BoutonActionMedia libelle="Partager" onClick={onShare}>
          <Share2 size={20} />
        </BoutonActionMedia>
        <BoutonActionMedia libelle="Plus d'actions" onClick={(e) => onOpenMore(e.clientX, e.clientY)}>
          <MoreHorizontal size={22} />
        </BoutonActionMedia>
      </EnteteMedia>

      {clipOuvert && song.videoUrl && (
        <VideoPlayerModal videoUrl={song.videoUrl} titre={song.title} sousTitre={song.artist?.stageName} onClose={() => setClipOuvert(false)} />
      )}
    </>
  );
}

