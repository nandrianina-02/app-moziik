import { Schema, models, model, Types, Model } from "mongoose";

/**
 * Marque d'une playlist produite par la curation hebdomadaire.
 *
 * Ces playlists sont des playlists ordinaires — on les ouvre, on les
 * écoute, on les suit. Un modèle séparé aurait obligé à dupliquer la page
 * de détail, le lecteur et le partage ; c'est la raison de ne pas en
 * avoir créé un.
 *
 * `statut` s'appuie sur `isPublic` plutôt que de le remplacer : un
 * brouillon reste `isPublic: false`, donc invisible partout où le site
 * filtre déjà sur ce champ. La confidentialité d'une proposition non
 * validée ne repose ainsi sur aucun code nouveau.
 */
export interface IPlaylistAuto {
  /** Identifiant de la recette (lib/curation/recipes.ts). */
  kind: string;
  /** Analyse dont elle est issue. */
  run: Types.ObjectId;
  statut: "brouillon" | "publiee" | "archivee";
  /** Pourquoi ces titres : phrase affichée à l'admin avant validation. */
  motif: string;
  genereeLe: Date;
  /** Rang souhaité dans la section d'accueil. */
  rang: number;
}

export interface IPlaylist {
  title: string;
  description?: string;
  coverUrl?: string;
  tags?: string[]; // mots-clés d'ambiance (Chill, Lo-fi...), distincts du genre des titres
  owner: Types.ObjectId; // ref User
  songs: Types.ObjectId[]; // ref Song
  isPublic: boolean;
  followers: Types.ObjectId[]; // Users qui suivent la playlist publique
  /** Absent sur toute playlist créée par un membre. */
  auto?: IPlaylistAuto;
  createdAt: Date;
}

const PlaylistSchema = new Schema<IPlaylist>({
  title: { type: String, required: true },
  description: { type: String },
  coverUrl: { type: String },
  tags: { type: [String], default: undefined },
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  songs: [{ type: Schema.Types.ObjectId, ref: "Song" }],
  isPublic: { type: Boolean, default: false },
  followers: [{ type: Schema.Types.ObjectId, ref: "User" }],
  auto: {
    type: new Schema<IPlaylistAuto>(
      {
        kind: { type: String, required: true },
        run: { type: Schema.Types.ObjectId, ref: "CurationRun", required: true },
        statut: { type: String, enum: ["brouillon", "publiee", "archivee"], default: "brouillon" },
        motif: { type: String, default: "" },
        genereeLe: { type: Date, default: Date.now },
        rang: { type: Number, default: 0 },
      },
      { _id: false }
    ),
    // Pas de `default` : son absence est ce qui distingue une playlist de
    // membre d'une playlist produite, et les index partiels ci-dessous
    // s'appuient dessus.
    required: false,
  },
  createdAt: { type: Date, default: Date.now },
});

// Index partiels : ils ne portent que sur les playlists produites, une
// fraction de la collection. Les playlists des membres n'en paient pas
// le coût.
PlaylistSchema.index(
  { "auto.run": 1, "auto.rang": 1 },
  { partialFilterExpression: { "auto.run": { $exists: true } } }
);
PlaylistSchema.index(
  { "auto.statut": 1, "auto.genereeLe": -1 },
  { partialFilterExpression: { "auto.statut": { $exists: true } } }
);

export default (models.Playlist as Model<IPlaylist>) || model<IPlaylist>("Playlist", PlaylistSchema);
