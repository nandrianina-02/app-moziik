import { Schema, models, model, Types, Model } from "mongoose";

export type Sentiment = "positive" | "neutral" | "negative";

export interface IComment {
  song: Types.ObjectId;
  user: Types.ObjectId;
  text: string;
  timestampInSong?: number; // secondes — commentaire ancré à un moment du son
  parentComment?: Types.ObjectId; // pour les réponses
  sentiment?: Sentiment; // calculé après création (analyse de sentiment)
  sentimentScore?: number; // -1 à 1
  likesCount: number;
  createdAt: Date;
}

const CommentSchema = new Schema<IComment>({
  song: { type: Schema.Types.ObjectId, ref: "Song", required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, required: true },
  timestampInSong: { type: Number },
  parentComment: { type: Schema.Types.ObjectId, ref: "Comment" },
  sentiment: { type: String, enum: ["positive", "neutral", "negative"] },
  sentimentScore: { type: Number },
  likesCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

export default (models.Comment as Model<IComment>) || model<IComment>("Comment", CommentSchema);
