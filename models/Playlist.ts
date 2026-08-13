import { Schema, models, model, Types, Model } from "mongoose";

export interface IPlaylist {
  title: string;
  description?: string;
  coverUrl?: string;
  owner: Types.ObjectId; // ref User
  songs: Types.ObjectId[]; // ref Song
  isPublic: boolean;
  followers: Types.ObjectId[]; // Users qui suivent la playlist publique
  createdAt: Date;
}

const PlaylistSchema = new Schema<IPlaylist>({
  title: { type: String, required: true },
  description: { type: String },
  coverUrl: { type: String },
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  songs: [{ type: Schema.Types.ObjectId, ref: "Song" }],
  isPublic: { type: Boolean, default: false },
  followers: [{ type: Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now },
});

export default (models.Playlist as Model<IPlaylist>) || model<IPlaylist>("Playlist", PlaylistSchema);
