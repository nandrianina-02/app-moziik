"use client";

import { useState } from "react";
import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";
import { useSession } from "next-auth/react";
import { Play, Pause, BadgeCheck, MoreVertical } from "lucide-react";
import { usePlayer, type PlayableSong, type PlaySource } from "@/context/PlayerProvider";
import { SongContextMenu } from "@/components/music/SongContextMenu";
import { useLongPress } from "@/components/music/useLongPress";
import { ShowMoreButton, useProgressiveList } from "@/components/ui/ShowMore";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function SongTableRow({
  song,
  queue,
  index,
  onDeleted,
  source,
}: {
  song: PlayableSong;
  queue: PlayableSong[];
  index: number;
  onDeleted?: () => void;
  source?: PlaySource;
}) {
  const { data: session } = useSession();
  const { currentSong, isPlaying, playQueue, togglePlay } = usePlayer();
  const isCurrent = currentSong?._id === song._id;
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState(false);

  const canManage =
    session?.user?.role === "admin" ||
    (session?.user?.role === "artist" && session.user.id === song.artist?._id);

  const albumTitle = typeof song.album === "string" ? undefined : song.album?.title;
  const albumId = typeof song.album === "string" ? song.album : song.album?._id;

  function handleClick() {
    if (isCurrent) {
      togglePlay();
    } else {
      playQueue(queue, index, source);
    }
  }

  function openMenuAt(x: number, y: number) {
    setMenuPosition({ x, y });
  }

  const longPress = useLongPress((x, y) => openMenuAt(x, y));

  return (
    <div
      className={`group grid grid-cols-[24px_1fr_auto] items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface sm:grid-cols-[24px_2.2fr_1.4fr_64px_auto] ${
        isCurrent ? "bg-surface" : ""
      }`}
      onContextMenu={(e) => {
        e.preventDefault();
        openMenuAt(e.clientX, e.clientY);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={longPress.onTouchStart}
      onTouchEnd={longPress.onTouchEnd}
      onTouchMove={longPress.onTouchMove}
    >
      <button
        onClick={handleClick}
        aria-label={isCurrent && isPlaying ? "Mettre en pause" : "Lire"}
        className="grid place-items-center text-xs text-ink-muted"
      >
        {hovered || isCurrent ? (
          isCurrent && isPlaying ? (
            <Pause size={14} className="text-accent" fill="currentColor" />
          ) : (
            <Play size={14} className={isCurrent ? "text-accent" : ""} fill="currentColor" />
          )
        ) : (
          index + 1
        )}
      </button>

      <button onClick={handleClick} className="flex min-w-0 items-center gap-3 text-left">
        <SafeImage src={song.coverUrl} alt={song.title} width={40} height={40} className="shrink-0 rounded-lg object-cover" />
        <span className="min-w-0">
          <span className={`block truncate text-sm ${isCurrent ? "text-accent" : ""}`}>{song.title}</span>
          <span className="flex items-center gap-1 truncate text-xs text-ink-muted sm:hidden">
            {song.artist?.stageName ?? "Artiste supprimé"}
          </span>
        </span>
      </button>

      <span className="hidden min-w-0 truncate text-sm text-ink-muted sm:flex sm:items-center sm:gap-1">
        {song.artist?.stageName ?? "Artiste supprimé"}
        {song.artist?.verified && <BadgeCheck size={12} className="shrink-0 text-verified" />}
      </span>

      <span className="hidden text-xs text-ink-muted sm:block">{formatTime(song.duration)}</span>

      <div className="flex shrink-0 items-center gap-1">
        {albumTitle && albumId && (
          <Link
            href={`/album/${albumId}`}
            className="hidden max-w-[8rem] truncate text-xs text-ink-muted hover:text-accent md:block"
          >
            {albumTitle}
          </Link>
        )}
        <button
          onClick={(e) => openMenuAt(e.clientX, e.clientY)}
          aria-label="Options du son"
          className="shrink-0 rounded-full p-1.5 text-ink-muted opacity-0 transition-opacity hover:bg-base hover:text-ink focus:opacity-100 group-hover:opacity-100"
        >
          <MoreVertical size={16} />
        </button>
      </div>

      {menuPosition && (
        <SongContextMenu
          song={song}
          position={menuPosition}
          canManage={canManage}
          onClose={() => setMenuPosition(null)}
          onDeleted={onDeleted}
        />
      )}
    </div>
  );
}

export function SongTable({
  songs,
  onDeleted,
  showHeader = true,
  source,
  initialCount = 0,
}: {
  songs: PlayableSong[];
  onDeleted?: () => void;
  showHeader?: boolean;
  source?: PlaySource;
  /** Nombre de morceaux affichés avant « Voir plus » (0 pour tout dérouler). */
  initialCount?: number;
}) {
  // La file de lecture reste la liste entière : `queue` reçoit `songs`,
  // pas la part visible — un morceau lancé depuis l'aperçu enchaîne sur
  // ceux qui ne sont pas encore dépliés.
  const { visible, hasMore, remaining, showMore } = useProgressiveList(songs, {
    initial: initialCount || songs.length,
    step: 25,
  });

  return (
    <div>
      {showHeader && (
        <div className="mb-1 hidden grid-cols-[24px_2.2fr_1.4fr_64px_auto] gap-3 px-2 pb-2 text-xs text-ink-muted sm:grid">
          <span>#</span>
          <span>Titre</span>
          <span>Artiste</span>
          <span>Durée</span>
          <span>Album</span>
        </div>
      )}
      <div className="space-y-0.5">
        {visible.map((song, index) => (
          <SongTableRow key={song._id} song={song} queue={songs} index={index} onDeleted={onDeleted} source={source} />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-3">
          <ShowMoreButton label="Voir plus de titres" remaining={remaining} onClick={showMore} />
        </div>
      )}
    </div>
  );
}
