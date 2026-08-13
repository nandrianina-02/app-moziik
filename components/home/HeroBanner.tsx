"use client";

import Link from "next/link";
import { Play, Users } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { usePlayer, type PlayableSong } from "@/context/PlayerProvider";

type HeroArtist = { _id: string; stageName: string; verified?: boolean; coverUrl?: string };

type HeroData = {
  source: "pinned" | "new_release" | "popular" | "playlist";
  contentType: "song" | "album" | "artist" | "playlist" | "event" | "custom";
  song?: PlayableSong;
  album?: { _id: string; title: string; coverUrl: string; artist: HeroArtist | null };
  artist?: HeroArtist;
  playlist?: { _id: string; title: string; coverUrl?: string; songs: string[] };
  event?: { _id: string; title: string; coverUrl?: string; location: string };
  custom?: { title: string; subtitle?: string; coverUrl?: string; href: string };
};

const sourceLabel: Record<HeroData["source"], string> = {
  pinned: "À la une",
  new_release: "Nouvelle sortie",
  popular: "Le plus populaire",
  playlist: "Playlist tendance",
};

export function HeroBanner({
  hero,
  newReleasesCount,
  relatedSongs = [],
}: {
  hero: HeroData;
  newReleasesCount: number;
  relatedSongs?: PlayableSong[];
}) {
  const { playQueue } = usePlayer();

  const coverUrl =
    hero.song?.coverUrl ??
    hero.album?.coverUrl ??
    hero.artist?.coverUrl ??
    hero.playlist?.coverUrl ??
    hero.event?.coverUrl ??
    hero.custom?.coverUrl;

  const title =
    hero.song?.title ??
    hero.album?.title ??
    hero.artist?.stageName ??
    hero.playlist?.title ??
    hero.event?.title ??
    hero.custom?.title ??
    "Moziik";

  const subtitle = hero.song
    ? hero.song.artist?.stageName ?? "Artiste supprimé"
    : hero.album
    ? hero.album.artist?.stageName ?? "Artiste supprimé"
    : hero.artist
    ? "Artiste en vedette"
    : hero.playlist
    ? `${hero.playlist.songs.length} titres`
    : hero.event
    ? hero.event.location
    : hero.custom
    ? hero.custom.subtitle ?? ""
    : "";

  const href = hero.song
    ? `/son/${hero.song._id}`
    : hero.album
    ? `/album/${hero.album._id}`
    : hero.artist
    ? `/artiste/${hero.artist._id}`
    : hero.playlist
    ? `/playlist/${hero.playlist._id}`
    : hero.event
    ? "/evenements"
    : hero.custom
    ? hero.custom.href
    : "/";

  function handlePlay() {
    if (!hero.song) return;
    const list = relatedSongs.some((s) => s._id === hero.song!._id) ? relatedSongs : [hero.song, ...relatedSongs];
    const index = list.findIndex((s) => s._id === hero.song!._id);
    playQueue(list, index !== -1 ? index : 0, { type: "home", label: "Accueil" });
  }

  return (
    <div className="relative overflow-hidden rounded-xl2 border border-border">
      <div className="absolute inset-0">
        <SafeImage src={coverUrl} alt="" width={1200} height={420} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/10" />
      </div>

      <div className="relative flex min-h-[280px] flex-col justify-center gap-4 px-6 py-8 md:px-10 md:py-10 md:max-w-lg">
        <span className="w-fit rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {sourceLabel[hero.source]}
        </span>
        <h2 className="font-display text-2xl leading-tight text-white md:text-3xl">{title}</h2>
        <p className="text-sm text-white/75">{subtitle}</p>

        <div className="flex flex-wrap items-center gap-4 pt-2">
          {hero.song ? (
            <button
              onClick={handlePlay}
              className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-base hover:bg-accent-hover"
            >
              <Play size={16} fill="currentColor" /> Écouter maintenant
            </button>
          ) : (
            <Link
              href={href}
              className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-base hover:bg-accent-hover"
            >
              Découvrir
            </Link>
          )}

          {newReleasesCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-white/70">
              <Users size={14} /> +{newReleasesCount} nouveaux titres cette semaine
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
