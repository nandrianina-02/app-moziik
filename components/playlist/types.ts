import type { PlayableSong } from "@/context/PlayerProvider";

export type PlaylistDetail = {
  _id: string;
  title: string;
  description?: string;
  coverUrl?: string;
  isPublic: boolean;
  // Peut manquer si le compte propriétaire a été supprimé : toujours
  // vérifier avant d'accéder à owner.name (même précaution que
  // `song.artist`, cf. PlayerProvider).
  owner: { _id: string; name?: string; avatarUrl?: string } | null;
  songs: PlayableSong[];
  followers?: string[];
  createdAt?: string;
};

export type PlaylistSummaryLite = {
  _id: string;
  title: string;
  coverUrl?: string;
  songs?: unknown[];
};
