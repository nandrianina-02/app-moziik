"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { BadgeCheck } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { usePlayer, type PlayableSong, type PlaySource } from "@/context/PlayerProvider";
import { SongContextMenu } from "@/components/music/SongContextMenu";
import { BoutonTelechargement } from "@/components/music/BoutonTelechargement";
import { BoutonLectureCarte } from "@/components/music/BoutonLectureCarte";
import { useLongPress } from "@/components/music/useLongPress";

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
  const { currentSong, playQueue, togglePlay } = usePlayer();
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
      // La carte entière s'éclaire au survol, comme sur Spotify : on vise la
      // carte, pas seulement sa pochette.
      className="pressable group w-full rounded-lg p-2 text-left transition-colors duration-200 hover:bg-ink/[0.06]"
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
        className="relative aspect-square w-full cursor-pointer overflow-hidden rounded-md bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
          <SafeImage
            src={song.coverUrl}
            alt={song.title}
            width={220}
            height={220}
            className="h-full w-full object-cover"
          />
          <BoutonLectureCarte titres={queue} depart={index} source={source ?? { type: "home" }} enCours={isCurrent} libelle={song.title} />
          {/* Hors du bouton de lecture, posé par-dessus : imbriquer un
              bouton dans un autre est invalide, et le clic du premier
              lancerait le second. */}
          <span className="absolute bottom-2 left-2">
            <BoutonTelechargement song={song} placement="pochette" />
          </span>
      </div>
      <button onClick={handleClick} className="w-full text-left">
        <p className={`mt-2.5 truncate text-sm font-semibold ${isCurrent ? "text-accent" : "text-ink"}`}>{song.title}</p>
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
