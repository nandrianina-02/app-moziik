"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Info,
  Mic2,
  MessageSquare,
  Disc3,
  BarChart3,
  Music2,
  BadgeCheck,
  FileText,
} from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { CommentsSection } from "@/components/music/CommentsSection";
import { CompactSongRow } from "@/components/song/CompactSongRow";
import { SongInfoCard } from "@/components/song/SongInfoCard";
import { formatCompactNumber } from "@/lib/formatNumber";
import type { SongDetail, AlbumSummary } from "@/components/song/types";
import type { PlayableSong } from "@/context/PlayerProvider";

type TabValue =
  "info" | "lyrics" | "comments" | "artist" | "album" | "stats" | "similar";

export function SongTabs({
  song,
  album,
  commentsCount,
  similarSongs,
  artistSongs,
}: {
  song: SongDetail;
  album: AlbumSummary | null;
  commentsCount: number;
  similarSongs: PlayableSong[];
  artistSongs: PlayableSong[];
}) {
  const tabs: { value: TabValue; label: string; icon: typeof Info }[] = [
    { value: "info", label: "Informations", icon: Info },
    { value: "lyrics", label: "Paroles", icon: FileText },
    { value: "comments", label: "Commentaires", icon: MessageSquare },
    { value: "artist", label: "Artiste", icon: Mic2 },
    ...(album
      ? [{ value: "album" as TabValue, label: "Album", icon: Disc3 }]
      : []),
    { value: "stats", label: "Statistiques", icon: BarChart3 },
    { value: "similar", label: "Similaires", icon: Music2 },
  ];

  const [tab, setTab] = useState<TabValue>("info");

  return (
    <div>
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border pb-px">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`relative flex shrink-0 items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium transition-colors ${
              tab === t.value ? "text-accent" : "text-ink-muted hover:text-ink"
            }`}
          >
            <t.icon size={14} />
            {t.label}
            {tab === t.value && (
              <motion.span
                layoutId="song-tab-underline"
                className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-accent"
              />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {tab === "info" && <InfoTab song={song} album={album} />}
          {tab === "lyrics" && <LyricsTab song={song} />}
          {tab === "comments" && <CommentsSection songId={song._id} />}
          {tab === "artist" && (
            <ArtistTab song={song} artistSongs={artistSongs} />
          )}
          {tab === "album" && album && <AlbumTab album={album} />}
          {tab === "stats" && (
            <StatsTab song={song} commentsCount={commentsCount} />
          )}
          {tab === "similar" && <SimilarTab songs={similarSongs} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function InfoTab({
  song,
  album,
}: {
  song: SongDetail;
  album: AlbumSummary | null;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SongInfoCard song={song} album={album} />
      {song.featuring && song.featuring.length > 0 && (
        <div className="rounded-xl2 border border-border bg-surface p-4">
          <h3 className="mb-3 text-sm font-medium">En featuring</h3>
          <ul className="space-y-2">
            {song.featuring.map((f) => (
              <li key={f.artist._id}>
                <Link
                  href={`/artiste/${f.artist._id}`}
                  className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-accent"
                >
                  {f.artist.stageName}
                  {f.artist.verified && (
                    <BadgeCheck size={12} className="text-verified" />
                  )}
                  {!f.confirmed && (
                    <span className="text-xs italic">(non confirmé)</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function LyricsTab({ song }: { song: SongDetail }) {
  if (!song.lyrics?.trim()) {
    return (
      <p className="rounded-xl2 border border-dashed border-border p-8 text-center text-sm text-ink-muted">
        Aucune parole disponible pour ce titre.
      </p>
    );
  }
  return (
    <div className="rounded-xl2 border border-border bg-surface p-6">
      <p className="selectionnable whitespace-pre-line text-sm leading-relaxed text-ink">
        {song.lyrics}
      </p>
    </div>
  );
}

function ArtistTab({
  song,
  artistSongs,
}: {
  song: SongDetail;
  artistSongs: PlayableSong[];
}) {
  if (!song.artist) {
    return (
      <p className="rounded-xl2 border border-dashed border-border p-8 text-center text-sm text-ink-muted">
        Artiste supprimé.
      </p>
    );
  }
  return (
    <div className="rounded-xl2 border border-border bg-surface p-5">
      <Link
        href={`/artiste/${song.artist._id}`}
        className="flex items-center gap-3"
      >
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-base text-lg font-medium">
          {song.artist.stageName.charAt(0).toUpperCase()}
        </span>
        <span>
          <span className="flex items-center gap-1.5 text-base text-ink font-medium">
            {song.artist.stageName}
            {song.artist.verified && (
              <BadgeCheck size={15} className="text-verified" />
            )}
          </span>
          <span className="text-xs text-ink-muted">
            Voir le profil complet →
          </span>
        </span>
      </Link>

      {artistSongs.length > 0 && (
        <div className="mt-5 space-y-2 border-t border-border pt-4">
          {artistSongs.map((s) => (
            <CompactSongRow key={s._id} song={s} queue={artistSongs} />
          ))}
        </div>
      )}
    </div>
  );
}

function AlbumTab({ album }: { album: AlbumSummary }) {
  const songs = (album.songs ?? []) as unknown as PlayableSong[];
  return (
    <div className="rounded-xl2 border border-border bg-surface p-5">
      <div className="mb-4 flex items-center gap-4">
        <SafeImage
          src={album.coverUrl}
          alt={album.title}
          width={72}
          height={72}
          className="shrink-0 rounded-xl object-cover"
        />
        <div>
          <Link
            href={`/album/${album._id}`}
            className="text-base text-ink font-medium hover:text-accent"
          >
            {album.title}
          </Link>
          <p className="text-xs text-ink-muted">
            {new Date(album.releaseDate).toLocaleDateString("fr-FR")}
          </p>
        </div>
      </div>
      {songs.length > 0 && (
        <div className="space-y-2 border-t border-border pt-4">
          {songs.map((s) => (
            <CompactSongRow key={s._id} song={s} queue={songs} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatsTab({
  song,
  commentsCount,
}: {
  song: SongDetail;
  commentsCount: number;
}) {
  const metrics = [
    { label: "Écoutes", value: song.playsCount ?? 0 },
    { label: "Favoris", value: song.likesCount ?? 0 },
    { label: "Commentaires", value: commentsCount },
    { label: "Partages", value: song.sharesCount ?? 0 },
  ];
  const max = Math.max(1, ...metrics.map((m) => m.value));

  return (
    <div className="rounded-xl2 border border-border bg-surface p-5">
      <div className="space-y-4">
        {metrics.map((m) => (
          <div key={m.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-ink-muted">{m.label}</span>
              <span className="font-medium">
                {formatCompactNumber(m.value)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-base">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(m.value / max) * 100}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="h-full rounded-full bg-accent"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SimilarTab({ songs }: { songs: PlayableSong[] }) {
  if (songs.length === 0) {
    return (
      <p className="rounded-xl2 border border-dashed border-border p-8 text-center text-sm text-ink-muted">
        Aucun titre similaire pour le moment.
      </p>
    );
  }
  return (
    <div className="rounded-xl2 border border-border bg-surface p-4">
      <div className="space-y-2">
        {songs.map((s) => (
          <CompactSongRow key={s._id} song={s} queue={songs} />
        ))}
      </div>
    </div>
  );
}
