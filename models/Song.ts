import { Schema, models, model, Types, Model } from "mongoose";

export type SongStatus = "draft" | "scheduled" | "published" | "rejected";

export interface ISongFeaturing {
  artist: Types.ObjectId;
  confirmed: boolean; // l'artiste crédité doit confirmer pour apparaître comme "vérifié" dans les crédits
}

export interface ISong {
  title: string;
  artist: Types.ObjectId; // ref Artist
  featuring: ISongFeaturing[]; // artistes en featuring
  album?: Types.ObjectId; // ref Album, absent si single
  audioUrl: string; // Cloudinary (resource_type: video)
  coverUrl: string;
  duration: number; // secondes
  genre: string;
  lyrics?: string;
  description?: string; // texte libre : histoire du morceau, inspiration...
  tags?: string[]; // mots-clés de découverte (distincts du genre)
  language?: string; // langue principale du morceau
  composer?: string; // texte libre — pas nécessairement un compte Moziik
  producer?: string; // texte libre — pas nécessairement un compte Moziik
  bpm?: number;
  musicalKey?: string; // tonalité (ex. "C#m")
  isrc?: string;
  copyright?: string;
  explicit: boolean;
  status: SongStatus;
  releaseDate: Date; // peut être future : planification de sortie
  publishedBy: Types.ObjectId; // artiste ou admin ayant publié
  approvedBy?: Types.ObjectId; // admin ayant validé (gestion complète par l'admin)
  playsCount: number;
  likesCount: number;
  sharesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const SongSchema = new Schema<ISong>({
  title: { type: String, required: true },
  artist: { type: Schema.Types.ObjectId, ref: "Artist", required: true, index: true },
  featuring: [
    {
      artist: { type: Schema.Types.ObjectId, ref: "Artist", required: true },
      confirmed: { type: Boolean, default: false },
    },
  ],
  album: { type: Schema.Types.ObjectId, ref: "Album" },
  audioUrl: { type: String, required: true },
  coverUrl: { type: String, required: true },
  duration: { type: Number, required: true },
  genre: { type: String, required: true },
  lyrics: { type: String },
  description: { type: String, maxlength: 5000 },
  tags: { type: [String], default: undefined },
  language: { type: String },
  composer: { type: String },
  producer: { type: String },
  bpm: { type: Number },
  musicalKey: { type: String },
  isrc: { type: String },
  copyright: { type: String },
  explicit: { type: Boolean, default: false },
  status: { type: String, enum: ["draft", "scheduled", "published", "rejected"], default: "draft" },
  releaseDate: { type: Date, required: true },
  publishedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  playsCount: { type: Number, default: 0 },
  likesCount: { type: Number, default: 0 },
  sharesCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
},
{
  // `updatedAt` géré automatiquement par Mongoose — sert d'indicateur
  // "Dernière modification" côté page d'édition. `createdAt` reste géré
  // manuellement ci-dessus (champ déjà en place, on évite de le dupliquer).
  timestamps: { createdAt: false, updatedAt: true },
});

SongSchema.index({ status: 1, releaseDate: 1 });
// status+genre : filtrés ensemble par /api/songs, /api/charts, /api/radio,
// et le moteur de la page d'accueil (sections genre/radio).
SongSchema.index({ status: 1, genre: 1 });

export default (models.Song as Model<ISong>) || model<ISong>("Song", SongSchema);
