"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { BadgeCheck, Play, Pause } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { usePlayer, type PlayableSong, type PlaySource } from "@/context/PlayerProvider";
import { SongContextMenu } from "@/components/music/SongContextMenu";
import { BoutonTelechargement } from "@/components/music/BoutonTelechargement";
import { useLongPress } from "@/components/music/useLongPress";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SongCard({
  song,
  queue,
  index,
  source,
  onDeleted,
}: {
  song: PlayableSong;
  queue: PlayableSong[];
  index: number;
  source?: PlaySource;
  onDeleted?: () => void;
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

  const longPress = useLongPress((x, y) => openMenuAt(x, y));

  return (
    <div
      className="pressable group w-full text-left"
      onContextMenu={(e) => {
        e.preventDefault();
        openMenuAt(e.clientX, e.clientY);
      }}
      onTouchStart={longPress.onTouchStart}
      onTouchEnd={longPress.onTouchEnd}
      onTouchMove={longPress.onTouchMove}
    >
      {/* La pochette sort du bouton : elle porte maintenant sa propre
          pastille, et un bouton ne peut pas en contenir un autre. Le clic
          sur l'image lance la lecture, comme avant. */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        className="relative aspect-square w-full cursor-pointer overflow-hidden rounded-xl2 bg-surface">
          <SafeImage
            src={song.coverUrl}
            alt={song.title}
            width={220}
            height={220}
            className="h-full w-full object-cover"
          />
          <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">
            {formatTime(song.duration)}
          </span>
          <span className="absolute inset-0 grid place-items-center bg-black/0 transition-colors group-hover:bg-black/30">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-base shadow-lg au-survol">
              {isCurrent && isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
            </span>
          </span>
          {/* Hors du bouton de lecture, posé par-dessus : imbriquer un
              bouton dans un autre est invalide, et le clic du premier
              lancerait le second. */}
          <span className="absolute bottom-2 left-2">
            <BoutonTelechargement song={song} placement="pochette" />
          </span>
      </div>
      <button onClick={handleClick} className="w-full text-left">
        <p className={`mt-2 truncate text-sm font-medium ${isCurrent ? "text-accent" : "text-ink"}`}>{song.title}</p>
        <p className="flex items-center gap-1 truncate text-xs text-ink-muted">
          {song.artist?.stageName ?? "Artiste supprimé"}
          {song.artist?.verified && <BadgeCheck size={11} className="shrink-0 text-verified" />}
        </p>
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
