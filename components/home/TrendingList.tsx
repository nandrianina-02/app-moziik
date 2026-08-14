"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { BadgeCheck, Play, Pause } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { usePlayer, type PlayableSong, type PlaySource } from "@/context/PlayerProvider";
import { SongContextMenu } from "@/components/music/SongContextMenu";
import { useLongPress } from "@/components/music/useLongPress";

/**
 * Classement numéroté (01, 02, …) façon "Tendances du moment" : format
 * compact pensé pour la colonne latérale de l'accueil, là où la grille de
 * cartes serait trop large. Conserve toutes les interactions d'une liste
 * de titres (lecture, menu contextuel au clic droit / appui long).
 */
export function TrendingList({ songs, source }: { songs: PlayableSong[]; source?: PlaySource }) {
  if (songs.length === 0) return null;
  return (
    <ol className="space-y-0.5">
      {songs.map((song, index) => (
        <TrendingRow key={song._id} song={song} songs={songs} index={index} source={source} />
      ))}
    </ol>
  );
}

function TrendingRow({
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

  const longPress = useLongPress((x, y) => setMenuPosition({ x, y }));

  return (
    <li
      className="group flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-base"
      onContextMenu={(e) => {
        e.preventDefault();
        setMenuPosition({ x: e.clientX, y: e.clientY });
      }}
      onTouchStart={longPress.onTouchStart}
      onTouchEnd={longPress.onTouchEnd}
      onTouchMove={longPress.onTouchMove}
    >
      <span
        className={`w-5 shrink-0 text-center font-mono text-[11px] tabular-nums ${
          isCurrent ? "text-accent" : "text-ink-muted"
        }`}
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      <SafeImage
        src={song.coverUrl}
        alt={song.title}
        width={36}
        height={36}
        className="h-9 w-9 shrink-0 rounded-lg object-cover"
      />

      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[13px] font-medium leading-tight ${isCurrent ? "text-accent" : "text-ink"}`}>
          {song.title}
        </span>
        <span className="flex items-center gap-1 truncate text-[11px] text-ink-muted">
          <span className="truncate">{song.artist?.stageName ?? "Artiste supprimé"}</span>
          {song.artist?.verified && <BadgeCheck size={10} className="shrink-0 text-verified" />}
        </span>
      </span>

      <button
        onClick={() => (isCurrent ? togglePlay() : playQueue(songs, index, source))}
        aria-label={isCurrent && isPlaying ? `Mettre en pause ${song.title}` : `Écouter ${song.title}`}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-muted opacity-0 transition-all hover:bg-accent hover:text-base focus-visible:opacity-100 group-hover:opacity-100"
      >
        {isCurrent && isPlaying ? (
          <Pause size={13} fill="currentColor" />
        ) : (
          <Play size={13} fill="currentColor" className="ml-0.5" />
        )}
      </button>

      {menuPosition && (
        <SongContextMenu
          song={song}
          position={menuPosition}
          canManage={canManage}
          onClose={() => setMenuPosition(null)}
        />
      )}
    </li>
  );
}
