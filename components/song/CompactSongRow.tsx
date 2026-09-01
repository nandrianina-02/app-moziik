"use client";

import { Pause, Play } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { usePlayer, type PlayableSong } from "@/context/PlayerProvider";

export function CompactSongRow({
  song,
  queue,
}: {
  song: PlayableSong;
  queue: PlayableSong[];
}) {
  const { currentSong, isPlaying, playQueue, togglePlay } = usePlayer();
  const isCurrent = currentSong?._id === song._id;

  function handleClick() {
    const index = queue.findIndex((s) => s._id === song._id);
    if (isCurrent) togglePlay();
    else playQueue(queue, index === -1 ? 0 : index);
  }

  return (
    <button
      onClick={handleClick}
      className="group flex w-full items-center gap-3 rounded-lg p-1 text-left transition-colors hover:bg-base"
    >
      <div className="relative shrink-0">
        <SafeImage
          src={song.coverUrl}
          alt={song.title}
          width={36}
          height={36}
          className="rounded-md object-cover"
        />
        <span className="absolute inset-0 grid place-items-center rounded-md bg-black/0 group-hover:bg-black/40 au-survol">
          {isCurrent && isPlaying ? (
            <Pause size={12} className="text-white" fill="currentColor" />
          ) : (
            <Play size={12} className="text-white" fill="currentColor" />
          )}
        </span>
      </div>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-sm ${isCurrent ? "text-accent" : "text-ink"}`}
        >
          {song.title}
        </span>
        <span className="block truncate text-xs text-ink-muted">
          {song.artist?.stageName ?? "Artiste supprimé"}
        </span>
      </span>
    </button>
  );
}
