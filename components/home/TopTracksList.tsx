"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { BadgeCheck, Play, Pause } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { usePlayer, type PlayableSong, type PlaySource } from "@/context/PlayerProvider";
import { SongContextMenu } from "@/components/music/SongContextMenu";
import { useLongPress } from "@/components/music/useLongPress";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TopTracksList({ songs, source }: { songs: PlayableSong[]; source?: PlaySource }) {
  return (
    <div className="stagger grid grid-cols-1 gap-x-8 gap-y-1 md:grid-cols-2">
      {songs.map((song, index) => (
        <TopTrackRow key={song._id} song={song} songs={songs} index={index} source={source} />
      ))}
    </div>
  );
}

function TopTrackRow({
  song,
  songs,
  index,
  source,
}: {
  song: PlayableSong;
  songs: PlayableSong[];
  index: number;
  source?: PlaySource;
}) {
  const { data: session } = useSession();
  const { currentSong, isPlaying, playQueue, togglePlay } = usePlayer();
  const isCurrent = currentSong?._id === song._id;
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

  const canManage =
    session?.user?.role === "admin" ||
    (session?.user?.role === "artist" && session.user.id === song.artist?._id);

  function openMenuAt(x: number, y: number) {
    setMenuPosition({ x, y });
  }
  const longPress = useLongPress((x, y) => openMenuAt(x, y));

  return (
    <div
      className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface"
      onContextMenu={(e) => {
        e.preventDefault();
        openMenuAt(e.clientX, e.clientY);
      }}
      onTouchStart={longPress.onTouchStart}
      onTouchEnd={longPress.onTouchEnd}
      onTouchMove={longPress.onTouchMove}
    >
      <button
        onClick={() => (isCurrent ? togglePlay() : playQueue(songs, index, source))}
        className="flex flex-1 items-center gap-3 text-left"
      >
        <span className="w-4 shrink-0 text-sm text-ink-muted">{index + 1}</span>
        <div className="relative shrink-0">
          <SafeImage src={song.coverUrl} alt={song.title} width={40} height={40} className="rounded-lg object-cover" />
          <span className="absolute inset-0 grid place-items-center rounded-lg bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            {isCurrent && isPlaying ? (
              <Pause size={14} className="text-white" fill="currentColor" />
            ) : (
              <Play size={14} className="text-white" fill="currentColor" />
            )}
          </span>
        </div>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm ${isCurrent ? "text-accent" : "text-ink"}`}>{song.title}</span>
          <span className="flex items-center gap-1 truncate text-xs text-ink-muted">
            {song.artist?.stageName ?? "Artiste supprimé"}
            {song.artist?.verified && <BadgeCheck size={11} className="shrink-0 text-verified" />}
          </span>
        </span>
        <span className="shrink-0 text-xs text-ink-muted">{formatTime(song.duration)}</span>
      </button>

      {menuPosition && (
        <SongContextMenu song={song} position={menuPosition} canManage={canManage} onClose={() => setMenuPosition(null)} />
      )}
    </div>
  );
}
