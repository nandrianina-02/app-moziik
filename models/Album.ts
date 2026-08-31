import { Schema, models, model, Types, Model } from "mongoose";
import { UNIVERS, UNIVERS_PAR_DEFAUT, type Univers } from "@/lib/univers";

export type AlbumType = "album" | "ep" | "single";

export interface IAlbum {
  title: string;
  artist: Types.ObjectId; // ref Artist
  coverUrl: string;
  bannerUrl?: string; // image d'arrière-plan affichée sur la page album
  description?: string; // texte "À propos de l'album", éditable par l'artiste propriétaire
  type: AlbumType;
  songs: Types.ObjectId[]; // ref Song
  releaseDate: Date;
  downloadsCount: number; // téléchargements de l'album complet (hors-ligne)
  /** Suit l'univers de son artiste (lib/universClassify.ts). */
  univers: Univers;
  createdAt: Date;
}

const AlbumSchema = new Schema<IAlbum>({
  title: { type: String, required: true },
  artist: { type: Schema.Types.ObjectId, ref: "Artist", required: true, index: true },
  coverUrl: { type: String, required: true },
  bannerUrl: { type: String },
  description: { type: String },
  type: { type: String, enum: ["album", "ep", "single"], default: "album" },
  songs: [{ type: Schema.Types.ObjectId, ref: "Song" }],
  releaseDate: { type: Date, required: true },
  downloadsCount: { type: Number, default: 0 },
  univers: { type: String, enum: UNIVERS, default: UNIVERS_PAR_DEFAUT, index: true },
  createdAt: { type: Date, default: Date.now },
});

export default (models.Album as Model<IAlbum>) || model<IAlbum>("Album", AlbumSchema);
