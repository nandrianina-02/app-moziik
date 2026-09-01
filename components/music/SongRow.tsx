"use client";

import { useState } from "react";
import { SafeImage } from "@/components/ui/SafeImage";
import { useSession } from "next-auth/react";
import { Play, Pause, BadgeCheck, Clock, MoreVertical } from "lucide-react";
import { usePlayer, type PlayableSong, type PlaySource } from "@/context/PlayerProvider";
import { SongContextMenu } from "@/components/music/SongContextMenu";
import { useLongPress } from "@/components/music/useLongPress";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SongRow({
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

  const canManage =
    session?.user?.role === "admin" ||
    (session?.user?.role === "artist" && session.user.id === song.artist?._id);

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

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    openMenuAt(e.clientX, e.clientY);
  }

  const longPress = useLongPress((x, y) => openMenuAt(x, y));

  return (
    <div
      className={`group w-full flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface ${
        isCurrent ? "bg-surface" : ""
      }`}
      onContextMenu={handleContextMenu}
      onTouchStart={longPress.onTouchStart}
      onTouchEnd={longPress.onTouchEnd}
      onTouchMove={longPress.onTouchMove}
    >
      <button onClick={handleClick} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <div className="relative shrink-0">
          <SafeImage src={song.coverUrl} alt={song.title} width={44} height={44} className="rounded-lg object-cover" />
          <span className="absolute inset-0 grid place-items-center rounded-lg bg-black/0 group-hover:bg-black/40 au-survol">
            {isCurrent && isPlaying ? (
              <Pause size={16} className="text-white" fill="currentColor" />
            ) : (
              <Play size={16} className="text-white" fill="currentColor" />
            )}
          </span>
        </div>

        <span className="min-w-0 flex-1">
          <span className={`block text-sm truncate ${isCurrent ? "text-accent" : ""}`}>{song.title}</span>
          <span className="flex items-center gap-1 text-xs text-ink-muted truncate">
            {song.artist?.stageName ?? "Artiste supprimé"}
            {song.artist?.verified && <BadgeCheck size={12} className="text-verified shrink-0" />}
            {song.featuring && song.featuring.length > 0 && (
              <span className="truncate">
                {" "}ft. {song.featuring.map((f) => f.artist.stageName).join(", ")}
              </span>
            )}
          </span>
        </span>
      </button>

      <span className="flex items-center gap-1 text-xs text-ink-muted shrink-0">
        <Clock size={12} />
        {formatTime(song.duration)}
      </span>

      <button
        onClick={(e) => openMenuAt(e.clientX, e.clientY)}
        aria-label="Options du son"
        className="shrink-0 text-ink-muted hover:text-ink p-1.5 rounded-full hover:bg-base au-survol"
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
