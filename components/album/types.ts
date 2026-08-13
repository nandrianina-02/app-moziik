import type { PlayableSong } from "@/context/PlayerProvider";

/**
 * Étend le album renvoyé par GET /api/albums/[id]. bannerUrl, description
 * et downloadsCount existent désormais dans le modèle Album (voir
 * models/Album.ts) ; ils restent optionnels ici pour ne rien casser tant
 * qu'un album existant en base ne les a pas encore renseignés.
 */
export type AlbumDetail = {
  _id: string;
  title: string;
  coverUrl: string;
  bannerUrl?: string | null;
  description?: string;
  type: "album" | "ep" | "single";
  releaseDate: string;
  downloadsCount?: number;
  artist: { _id: string; stageName: string; verified?: boolean; bio?: string } | null;
  songs: PlayableSong[];
};

export type AlbumSummaryLite = {
  _id: string;
  title: string;
  coverUrl: string;
  type: "album" | "ep" | "single";
  releaseDate: string;
};

export type AlbumComment = {
  _id: string;
  text: string;
  createdAt: string;
  song: string;
  songTitle: string | null;
  user: { _id: string; name: string; avatarUrl?: string };
};
