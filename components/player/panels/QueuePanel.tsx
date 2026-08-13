"use client";

import { useState } from "react";
import { SafeImage } from "@/components/ui/SafeImage";
import { Play, MoreVertical } from "lucide-react";
import { usePlayer } from "@/context/PlayerProvider";
import { SongContextMenu } from "@/components/music/SongContextMenu";
import { useLongPress } from "@/components/music/useLongPress";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function QueuePanel() {
  const { queue, currentSong, isPlaying, playQueue } = usePlayer();
  const [menu, setMenu] = useState<{ x: number; y: number; index: number } | null>(null);

  if (queue.length === 0) {
    return <p className="text-sm text-ink-muted">La file d&apos;attente est vide.</p>;
  }

  return (
    <ul className="space-y-1">
      {queue.map((song, index) => (
        <QueueRow
          key={song._id}
          song={song}
          index={index}
          isCurrent={song._id === currentSong?._id}
          isPlaying={isPlaying}
          onPlay={() => playQueue(queue, index)}
          onOpenMenu={(x, y) => setMenu({ x, y, index })}
        />
      ))}

      {menu && (
        <SongContextMenu song={queue[menu.index]} position={{ x: menu.x, y: menu.y }} onClose={() => setMenu(null)} />
      )}
    </ul>
  );
}

function QueueRow({
  song,
  index,
  isCurrent,
  isPlaying,
  onPlay,
  onOpenMenu,
}: {
  song: ReturnType<typeof usePlayer>["queue"][number];
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onOpenMenu: (x: number, y: number) => void;
}) {
  const longPress = useLongPress((x, y) => onOpenMenu(x, y));

  return (
    <li
      className={`group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface ${
        isCurrent ? "bg-accent/10" : ""
      }`}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpenMenu(e.clientX, e.clientY);
      }}
      onTouchStart={longPress.onTouchStart}
      onTouchEnd={longPress.onTouchEnd}
      onTouchMove={longPress.onTouchMove}
    >
      <button onClick={onPlay} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        {isCurrent ? (
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-base">
            {isPlaying ? (
              <span className="inline-flex h-2.5 items-end gap-[2px]" role="status" aria-label="Lecture en cours">
                <span className="w-[2px] h-full origin-bottom rounded-sm bg-base animate-eq1" />
                <span className="w-[2px] h-full origin-bottom rounded-sm bg-base animate-eq2" />
                <span className="w-[2px] h-full origin-bottom rounded-sm bg-base animate-eq3" />
              </span>
            ) : (
              <Play size={11} fill="currentColor" />
            )}
          </span>
        ) : (
          <span className="w-6 shrink-0 text-center text-xs text-ink-muted">{index + 1}</span>
        )}
        <SafeImage src={song.coverUrl} alt={song.title} width={36} height={36} className="shrink-0 rounded-lg object-cover" />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm ${isCurrent ? "font-medium text-accent" : ""}`}>{song.title}</span>
          <span className="block truncate text-xs text-ink-muted">{song.artist?.stageName ?? "Artiste supprimé"}</span>
        </span>
      </button>
      <span className="shrink-0 text-xs text-ink-muted">{formatTime(song.duration)}</span>
      <button
        onClick={(e) => onOpenMenu(e.clientX, e.clientY)}
        aria-label="Options du son"
        className="shrink-0 rounded-full p-1 text-ink-muted opacity-0 transition-opacity hover:bg-base hover:text-ink focus:opacity-100 group-hover:opacity-100"
      >
        <MoreVertical size={15} />
      </button>
    </li>
  );
}
