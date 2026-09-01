import type { LucideIcon } from "lucide-react";
import { Play, Heart, Clock, Disc3, Music2, CalendarDays, Globe2, Lock, Users } from "lucide-react";
import type { PlayableSong } from "@/context/PlayerProvider";
import { libelleTypeAlbum, type AlbumType } from "@/lib/albums";

const statIcons = {
  play: Play,
  heart: Heart,
  clock: Clock,
  disc: Disc3,
  music: Music2,
  calendar: CalendarDays,
  globe: Globe2,
  lock: Lock,
  users: Users,
};

export type ShareSubjectType = "song" | "album" | "playlist" | "artist" | "profile";

export type ShareStat = { icon: LucideIcon; label: string; value: string };

export type ShareSubject = {
  type: ShareSubjectType;
  id: string;
  title: string;
  subtitle?: string;
  verified?: boolean;
  coverUrl?: string;
  path: string;
  stats: ShareStat[];
};

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function buildSongSubject(song: PlayableSong, albumTitle?: string): ShareSubject {
  return {
    type: "song",
    id: song._id,
    title: song.title,
    subtitle: song.artist?.stageName,
    verified: song.artist?.verified,
    coverUrl: song.coverUrl,
    path: `/son/${song._id}`,
    stats: [
      { icon: statIcons.play, label: "Écoutes", value: formatCompactSafe(song.playsCount) },
      { icon: statIcons.heart, label: "Favoris", value: formatCompactSafe(song.likesCount) },
      { icon: statIcons.clock, label: "Durée", value: formatDuration(song.duration) },
    ],
    ...(albumTitle ? { subtitle: song.artist ? `${song.artist.stageName} · ${albumTitle}` : albumTitle } : {}),
  };
}

export function buildAlbumSubject(album: {
  _id: string;
  title: string;
  coverUrl: string;
  type?: AlbumType;
  releaseDate?: string;
  artist?: { stageName: string; verified?: boolean } | null;
  songs?: unknown[];
  songsCount?: number;
}): ShareSubject {
  const typeLabel = album.type ? libelleTypeAlbum(album.type) : undefined;
  const trackCount = album.songs?.length ?? album.songsCount;
  return {
    type: "album",
    id: album._id,
    title: album.title,
    subtitle: album.artist?.stageName,
    verified: album.artist?.verified,
    coverUrl: album.coverUrl,
    path: `/album/${album._id}`,
    stats: [
      ...(typeLabel ? [{ icon: statIcons.disc, label: "Type", value: typeLabel }] : []),
      ...(typeof trackCount === "number" ? [{ icon: statIcons.music, label: "Titres", value: String(trackCount) }] : []),
      ...(album.releaseDate ? [{ icon: statIcons.calendar, label: "Sortie", value: new Date(album.releaseDate).getFullYear().toString() }] : []),
    ],
  };
}

export function buildPlaylistSubject(playlist: {
  _id: string;
  title: string;
  coverUrl?: string;
  isPublic: boolean;
  owner?: { name: string };
  songs?: unknown[];
  songsCount?: number;
}): ShareSubject {
  const trackCount = playlist.songs?.length ?? playlist.songsCount ?? 0;
  return {
    type: "playlist",
    id: playlist._id,
    title: playlist.title,
    subtitle: playlist.owner ? `Par ${playlist.owner.name}` : undefined,
    coverUrl: playlist.coverUrl,
    path: `/playlist/${playlist._id}`,
    stats: [
      { icon: statIcons.music, label: "Titres", value: String(trackCount) },
      { icon: playlist.isPublic ? statIcons.globe : statIcons.lock, label: "Visibilité", value: playlist.isPublic ? "Publique" : "Privée" },
    ],
  };
}

export function buildArtistSubject(artist: {
  _id: string;
  stageName: string;
  verified?: boolean;
  coverUrl?: string;
  followersCount?: number;
  songsCount?: number;
  albumsCount?: number;
}, isOwnProfile = false): ShareSubject {
  return {
    type: isOwnProfile ? "profile" : "artist",
    id: artist._id,
    title: isOwnProfile ? "Mon profil d'artiste" : artist.stageName,
    subtitle: isOwnProfile ? artist.stageName : undefined,
    verified: artist.verified,
    coverUrl: artist.coverUrl,
    path: `/artiste/${artist._id}`,
    stats: [
      { icon: statIcons.users, label: "Abonnés", value: formatCompactSafe(artist.followersCount) },
      ...(typeof artist.songsCount === "number" ? [{ icon: statIcons.music, label: "Titres", value: String(artist.songsCount) }] : []),
      ...(typeof artist.albumsCount === "number" ? [{ icon: statIcons.disc, label: "Albums", value: String(artist.albumsCount) }] : []),
    ],
  };
}

function formatCompactSafe(value?: number) {
  return new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(value ?? 0);
}
