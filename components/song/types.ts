import type { PlayableSong } from "@/context/PlayerProvider";
import type { AlbumType } from "@/lib/albums";

/**
 * Étend PlayableSong avec les champs réellement renvoyés par
 * GET /api/songs/[id] mais absents du type partagé du lecteur
 * (sharesCount, status...), plus des champs optionnels qui n'existent
 * pas encore dans le modèle Song (label, compositeur, langue,
 * téléchargements, popularité). Tant que le backend ne les renvoie
 * pas, ces champs restent `undefined` et les blocs correspondants ne
 * s'affichent simplement pas — aucune donnée n'est inventée. Le jour
 * où ils existeront côté API, l'affichage s'activera automatiquement.
 */
export type SongDetail = PlayableSong & {
  /** Clip vidéo du morceau, s'il en a un. */
  videoUrl?: string;
  explicit?: boolean;
  status?: "draft" | "scheduled" | "published" | "rejected";
  sharesCount?: number;
  createdAt?: string;

  // Prêt à l'emploi dès que le modèle Song les exposera :
  label?: string;
  composer?: string;
  language?: string;
  downloadsCount?: number;
  popularityScore?: number; // 0-100
};

export type AlbumSummary = {
  _id: string;
  title: string;
  coverUrl: string;
  type: AlbumType;
  releaseDate: string;
  songs?: { _id: string }[];
};

export type PlaylistSummary = {
  _id: string;
  title: string;
  coverUrl?: string;
  songs: string[];
};
