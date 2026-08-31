"use client";

import { useState } from "react";
import { SafeImage } from "@/components/ui/SafeImage";
import { useSession } from "next-auth/react";
import { Play, Pause, BadgeCheck, Heart, MoreVertical } from "lucide-react";
import { usePlayer, type PlayableSong, type PlaySource } from "@/context/PlayerProvider";
import { SongContextMenu } from "@/components/music/SongContextMenu";
import { useLongPress } from "@/components/music/useLongPress";
import { ShowMoreButton, useProgressiveList } from "@/components/ui/ShowMore";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")} K`;
  return `${n}`;
}

function ArtistSongRow({
  song,
  queue,
  index,
  rank,
  source,
  onDeleted,
}: {
  song: PlayableSong;
  queue: PlayableSong[];
  index: number;
  rank?: number;
  source?: PlaySource;
  onDeleted?: () => void;
}) {
  const { data: session } = useSession();
  const { currentSong, isPlaying, playQueue, togglePlay } = usePlayer();
  const isCurrent = currentSong?._id === song._id;
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState(false);

  const canManage =
    session?.user?.role === "admin" ||
    (session?.user?.role === "artist" && session.user.id === song.artist?._id);

  function handleClick() {
    if (isCurrent) togglePlay();
    else playQueue(queue, index, source);
  }

  const longPress = useLongPress((x, y) => setMenuPosition({ x, y }));

  return (
    <div
      className="group grid grid-cols-[24px_1fr_auto] items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface sm:grid-cols-[24px_2.2fr_70px_80px_56px_auto]"
      onContextMenu={(e) => {
        e.preventDefault();
        setMenuPosition({ x: e.clientX, y: e.clientY });
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={longPress.onTouchStart}
      onTouchEnd={longPress.onTouchEnd}
      onTouchMove={longPress.onTouchMove}
    >
      <button onClick={handleClick} aria-label={isCurrent && isPlaying ? "Mettre en pause" : "Lire"} className="grid place-items-center text-xs text-ink-muted">
        {hovered || isCurrent ? (
          isCurrent && isPlaying ? (
            <Pause size={14} className="text-accent" fill="currentColor" />
          ) : (
            <Play size={14} className={isCurrent ? "text-accent" : ""} fill="currentColor" />
          )
        ) : (
          rank ?? index + 1
        )}
      </button>

      <button onClick={handleClick} className="flex min-w-0 items-center gap-3 text-left">
        <SafeImage src={song.coverUrl} alt={song.title} width={40} height={40} className="shrink-0 rounded-lg object-cover" />
        <span className="min-w-0">
          <span className={`block truncate text-sm ${isCurrent ? "text-accent" : ""}`}>{song.title}</span>
          <span className="flex items-center gap-1 truncate text-xs text-ink-muted">
            {song.artist?.stageName ?? "Artiste supprimé"}
            {song.artist?.verified && <BadgeCheck size={11} className="shrink-0 text-verified" />}
          </span>
        </span>
      </button>

      <span className="hidden items-center gap-1 text-xs text-ink-muted sm:flex">
        <Heart size={12} /> {formatCompact(song.likesCount ?? 0)}
      </span>
      <span className="hidden items-center gap-1 text-xs text-ink-muted sm:flex">
        <Play size={11} fill="currentColor" /> {formatCompact(song.playsCount ?? 0)}
      </span>
      <span className="hidden text-xs text-ink-muted sm:block">{formatTime(song.duration)}</span>

      <button
        onClick={(e) => setMenuPosition({ x: e.clientX, y: e.clientY })}
        aria-label="Options du son"
        className="shrink-0 rounded-full p-1.5 text-ink-muted opacity-0 transition-opacity hover:bg-base hover:text-ink focus:opacity-100 group-hover:opacity-100"
      >
        <MoreVertical size={16} />
      </button>

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

export function ArtistSongList({
  songs,
  queue,
  showRankFrom,
  source,
  onDeleted,
  initialCount = 0,
}: {
  songs: PlayableSong[];
  queue?: PlayableSong[];
  showRankFrom?: number;
  source?: PlaySource;
  onDeleted?: () => void;
  /** Nombre de morceaux affichés avant « Voir plus » (0 pour tout dérouler). */
  initialCount?: number;
}) {
  const effectiveQueue = queue ?? songs;
  // La discographie complète d'un artiste dépasse vite l'écran ; la file de
  // lecture, elle, garde tous les morceaux — seul l'affichage se déroule.
  const { visible, hasMore, remaining, showMore } = useProgressiveList(songs, {
    initial: initialCount || songs.length,
    step: 20,
  });

  return (
    <div className="space-y-0.5">
      {visible.map((song, i) => {
        const queueIndex = effectiveQueue.findIndex((s) => s._id === song._id);
        return (
          <ArtistSongRow
            key={song._id}
            song={song}
            queue={effectiveQueue}
            index={queueIndex !== -1 ? queueIndex : i}
            rank={showRankFrom !== undefined ? showRankFrom + i : undefined}
            source={source}
            onDeleted={onDeleted}
          />
        );
      })}

      {hasMore && (
        <div className="flex justify-center pt-3">
          <ShowMoreButton label="Voir plus de morceaux" remaining={remaining} onClick={showMore} />
        </div>
      )}
    </div>
  );
}
