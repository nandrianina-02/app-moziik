"use client";

import { BadgeCheck, Pause, Play } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { usePlayer, type PlayableSong } from "@/context/PlayerProvider";

export function RecentlyPlayedRow({ songs }: { songs: PlayableSong[] }) {
  const { currentSong, isPlaying, playQueue, togglePlay } = usePlayer();

  if (songs.length === 0) return null;

  return (
    <div className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none]">
      {songs.map((song, index) => {
        const isCurrent = currentSong?._id === song._id;

        function handleClick() {
          if (isCurrent) togglePlay();
          else playQueue(songs, index, { type: "home", label: "Écoutes récemment" });
        }

        return (
          <button key={song._id} onClick={handleClick} className="w-28 shrink-0 text-left sm:w-32">
            <div className="relative aspect-square w-full overflow-hidden rounded-xl2 bg-surface">
              <SafeImage src={song.coverUrl} alt={song.title} width={140} height={140} className="h-full w-full object-cover" />
              {/* La pastille déborde de la pochette, donc sur le fond de
                  page : en blanc sur blanc elle disparaissait en thème
                  clair. bg-ink / text-base s'inverse avec le thème. */}
              <span className="absolute -bottom-2 -right-2 grid h-9 w-9 place-items-center rounded-full bg-ink text-base shadow-lg">
                {isCurrent && isPlaying ? (
                  <Pause size={15} fill="currentColor" />
                ) : (
                  <Play size={15} fill="currentColor" />
                )}
              </span>
            </div>
            <p className={`mt-3 truncate text-sm font-medium ${isCurrent ? "text-accent" : "text-ink"}`}>{song.title}</p>
            <p className="flex items-center gap-1 truncate text-xs text-ink-muted">
              {song.artist?.stageName ?? "Artiste supprimé"}
              {song.artist?.verified && <BadgeCheck size={11} className="shrink-0 text-verified" />}
            </p>
          </button>
        );
      })}
    </div>
  );
}
