"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Play, Pause, Heart, MoreVertical } from "lucide-react";
import { usePlayer, type PlayableSong } from "@/context/PlayerProvider";
import { useToast } from "@/context/ToastProvider";
import { SongContextMenu } from "@/components/music/SongContextMenu";
import { useLongPress } from "@/components/music/useLongPress";
import { formatCompactNumber } from "@/lib/formatNumber";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AlbumSongRow({
  song,
  queue,
  index,
  onDeleted,
}: {
  song: PlayableSong;
  queue: PlayableSong[];
  index: number;
  onDeleted?: () => void;
}) {
  const { data: session } = useSession();
  const pushToast = useToast();
  const { currentSong, isPlaying, playQueue, togglePlay } = usePlayer();
  const isCurrent = currentSong?._id === song._id;
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(song.likesCount ?? 0);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

  const canManage =
    session?.user?.role === "admin" ||
    (session?.user?.role === "artist" && session.user.id === song.artist?._id);

  useEffect(() => {
    fetch(`/api/songs/${song._id}/like`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setLiked(data.liked))
      .catch(() => {});
  }, [song._id]);

  function handleClick() {
    if (isCurrent) togglePlay();
    else playQueue(queue, index, { type: "album" });
  }

  async function toggleLike(e: React.MouseEvent) {
    e.stopPropagation();
    const optimistic = !liked;
    setLiked(optimistic);
    setLikesCount((c) => c + (optimistic ? 1 : -1));
    try {
      const res = await fetch(`/api/songs/${song._id}/like`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLiked(data.liked);
      setLikesCount(data.likesCount);
    } catch {
      setLiked(!optimistic);
      setLikesCount((c) => c - (optimistic ? 1 : -1));
      pushToast("error", "Connecte-toi pour aimer un titre.");
    }
  }

  function openMenuAt(x: number, y: number) {
    setMenuPosition({ x, y });
  }
  const longPress = useLongPress((x, y) => openMenuAt(x, y));

  return (
    <div
      className={`group grid grid-cols-[28px_1fr_auto_auto_auto] items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-base sm:grid-cols-[28px_1fr_60px_70px_auto] ${
        isCurrent ? "bg-base" : ""
      }`}
      onContextMenu={(e) => {
        e.preventDefault();
        openMenuAt(e.clientX, e.clientY);
      }}
      onTouchStart={longPress.onTouchStart}
      onTouchEnd={longPress.onTouchEnd}
      onTouchMove={longPress.onTouchMove}
    >
      <button
        onClick={handleClick}
        aria-label={isCurrent && isPlaying ? "Mettre en pause" : "Lire"}
        className="grid h-6 w-6 place-items-center text-ink-muted transition-colors group-hover:text-accent"
      >
        <span className="group-hover:hidden">
          {isCurrent && isPlaying ? (
            <span className="flex items-end gap-[2px]">
              <span className="h-2.5 w-[3px] animate-pulse rounded-full bg-accent" />
              <span className="h-1.5 w-[3px] animate-pulse rounded-full bg-accent [animation-delay:150ms]" />
              <span className="h-3 w-[3px] animate-pulse rounded-full bg-accent [animation-delay:300ms]" />
            </span>
          ) : (
            <span className={isCurrent ? "text-accent" : ""}>{index + 1}</span>
          )}
        </span>
        <span className="hidden group-hover:block">
          {isCurrent && isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
        </span>
      </button>

      <button onClick={handleClick} className="min-w-0 text-left">
        <span className={`block truncate text-sm font-medium ${isCurrent ? "text-accent" : "text-ink"}`}>
          {song.title}
        </span>
        <span className="block truncate text-xs text-ink-muted">
          {song.artist?.stageName ?? "Artiste supprimé"}
        </span>
      </button>

      <button
        onClick={toggleLike}
        aria-label={liked ? "Ne plus aimer" : "J'aime"}
        className={`hidden shrink-0 items-center justify-center gap-1 transition-colors sm:flex ${
          liked ? "text-accent" : "text-ink-muted hover:text-accent"
        }`}
      >
        <Heart size={16} fill={liked ? "currentColor" : "none"} />
        {likesCount > 0 && <span className="text-xs">{formatCompactNumber(likesCount)}</span>}
      </button>

      <span className="hidden shrink-0 text-right text-xs text-ink-muted sm:block">
        {formatCompactNumber(song.playsCount ?? 0)}
      </span>

      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-ink-muted">{formatDuration(song.duration)}</span>
        <button
          onClick={(e) => openMenuAt(e.clientX, e.clientY)}
          aria-label="Options du titre"
          className="shrink-0 rounded-full p-1.5 text-ink-muted opacity-0 transition-opacity hover:bg-surface hover:text-ink group-hover:opacity-100 focus:opacity-100"
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
