"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Play, Pause, Heart, MoreVertical, Clock } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { usePlayer, type PlayableSong, type PlaySource } from "@/context/PlayerProvider";
import { useToast } from "@/context/ToastProvider";
import { SongContextMenu } from "@/components/music/SongContextMenu";
import { useLongPress } from "@/components/music/useLongPress";

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Grille commune à l'en-tête et aux lignes : les colonnes doivent
 * s'aligner exactement, une seule définition évite qu'elles divergent.
 *
 * Sous `lg`, Artiste et Album disparaissent — les afficher tasserait le
 * titre au point de le rendre illisible. L'artiste reste visible sous le
 * titre dans ce cas, jamais perdu.
 */
const GRID =
  "grid grid-cols-[24px_minmax(0,1fr)_32px_44px_32px] items-center gap-2 sm:gap-3 lg:grid-cols-[28px_minmax(0,2fr)_36px_minmax(0,1fr)_minmax(0,1fr)_52px_36px]";

function albumOf(song: PlayableSong): { id?: string; title: string } | null {
  if (!song.album) return null;
  if (typeof song.album === "string") return null; // seulement l'identifiant, pas de titre à afficher
  return { id: song.album._id, title: song.album.title };
}

/**
 * Tableau des titres façon maquette Moziik : numéro, pochette + titre,
 * favori, artiste, album, durée, menu. Partagé par la page album et la
 * page playlist pour qu'elles restent identiques au pixel près.
 */
export function TrackTable({
  songs,
  source,
  albumFallback,
  onReload,
}: {
  songs: PlayableSong[];
  source?: PlaySource;
  /** Titre d'album à afficher quand les morceaux ne le portent pas (page album). */
  albumFallback?: { id: string; title: string };
  onReload?: () => void;
}) {
  return (
    <div className="rounded-xl2 border border-border bg-surface p-2 sm:p-3">
      <div className={`${GRID} border-b border-border px-2.5 pb-2 text-[11px] uppercase tracking-wide text-ink-muted`}>
        <span>#</span>
        <span>Titre</span>
        <span />
        <span className="hidden lg:block">Artiste</span>
        <span className="hidden lg:block">Album</span>
        <span className="flex justify-end lg:justify-start">
          <Clock size={13} />
        </span>
        {/* Colonne du menu « … » : toujours rendue, y compris sur mobile,
            sinon l'en-tête compterait une cellule de moins que les lignes
            et toutes les colonnes se décaleraient. */}
        <span />
      </div>

      <div className="mt-1 space-y-0.5">
        {songs.map((song, index) => (
          <TrackRow
            key={song._id}
            song={song}
            queue={songs}
            index={index}
            source={source}
            albumFallback={albumFallback}
            onDeleted={onReload}
          />
        ))}
      </div>
    </div>
  );
}

function TrackRow({
  song,
  queue,
  index,
  source,
  albumFallback,
  onDeleted,
}: {
  song: PlayableSong;
  queue: PlayableSong[];
  index: number;
  source?: PlaySource;
  albumFallback?: { id: string; title: string };
  onDeleted?: () => void;
}) {
  const { data: session, status } = useSession();
  const pushToast = useToast();
  const { currentSong, isPlaying, playQueue, togglePlay } = usePlayer();
  const isCurrent = currentSong?._id === song._id;

  const [liked, setLiked] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

  const canManage =
    session?.user?.role === "admin" ||
    (session?.user?.role === "artist" && session.user.id === song.artist?._id);

  useEffect(() => {
    // Inutile d'interroger l'API pour un visiteur : la réponse serait
    // toujours « non aimé », et cela multipliait les appels sur une page
    // de 60 titres.
    if (status !== "authenticated") {
      setLiked(false);
      return;
    }
    fetch(`/api/songs/${song._id}/like`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setLiked(data.liked))
      .catch(() => {});
  }, [song._id, status]);

  function handlePlay() {
    if (isCurrent) togglePlay();
    else playQueue(queue, index, source);
  }

  async function toggleLike(e: React.MouseEvent) {
    e.stopPropagation();
    if (status !== "authenticated") {
      pushToast("error", "Connecte-toi pour aimer un titre.");
      return;
    }
    const optimiste = !liked;
    setLiked(optimiste);
    try {
      const res = await fetch(`/api/songs/${song._id}/like`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLiked(data.liked);
    } catch {
      setLiked(!optimiste);
      pushToast("error", "Échec de l'action.");
    }
  }

  const longPress = useLongPress((x, y) => setMenuPosition({ x, y }));
  const album = albumOf(song) ?? albumFallback ?? null;

  return (
    <div
      className={`group ${GRID} rounded-xl px-2.5 py-2 transition-colors hover:bg-base ${isCurrent ? "bg-base" : ""}`}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenuPosition({ x: e.clientX, y: e.clientY });
      }}
      onTouchStart={longPress.onTouchStart}
      onTouchEnd={longPress.onTouchEnd}
      onTouchMove={longPress.onTouchMove}
    >
      <button
        onClick={handlePlay}
        aria-label={isCurrent && isPlaying ? "Mettre en pause" : `Lire ${song.title}`}
        className="grid h-6 w-6 place-items-center text-xs tabular-nums text-ink-muted transition-colors group-hover:text-accent"
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

      <button onClick={handlePlay} className="flex min-w-0 items-center gap-3 text-left">
        <SafeImage
          src={song.coverUrl}
          alt={song.title}
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 rounded-lg object-cover"
        />
        <span className="min-w-0">
          <span className={`block truncate text-sm font-medium ${isCurrent ? "text-accent" : "text-ink"}`}>
            {song.title}
          </span>
          {/* L'artiste a sa propre colonne à partir de lg ; en dessous il
              reste ici, sous le titre, pour ne jamais disparaître. */}
          <span className="block truncate text-xs text-ink-muted lg:hidden">
            {song.artist?.stageName ?? "Artiste supprimé"}
          </span>
        </span>
      </button>

      <button
        onClick={toggleLike}
        aria-label={liked ? "Ne plus aimer" : "J'aime"}
        className={`grid h-8 w-8 place-items-center transition-colors ${
          liked ? "text-accent" : "text-ink-muted hover:text-accent"
        }`}
      >
        <Heart size={16} fill={liked ? "currentColor" : "none"} />
      </button>

      <span className="hidden min-w-0 lg:block">
        {song.artist ? (
          <Link
            href={`/artiste/${song.artist._id}`}
            className="block truncate text-sm text-ink-muted transition-colors hover:text-ink"
          >
            {song.artist.stageName}
          </Link>
        ) : (
          <span className="block truncate text-sm italic text-ink-muted">Artiste supprimé</span>
        )}
      </span>

      <span className="hidden min-w-0 lg:block">
        {album?.id ? (
          <Link
            href={`/album/${album.id}`}
            className="block truncate text-sm text-ink-muted transition-colors hover:text-ink"
          >
            {album.title}
          </Link>
        ) : (
          <span className="block truncate text-sm text-ink-muted">{album?.title ?? "—"}</span>
        )}
      </span>

      <span className="text-right text-xs tabular-nums text-ink-muted lg:text-left">
        {formatDuration(song.duration)}
      </span>

      <button
        onClick={(e) => setMenuPosition({ x: e.clientX, y: e.clientY })}
        aria-label={`Options de ${song.title}`}
        className="grid h-8 w-8 place-items-center rounded-full text-ink-muted transition-all hover:bg-surface hover:text-ink lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100"
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
