import { Schema, models, model, Types, Model } from "mongoose";

export type Sentiment = "positive" | "neutral" | "negative";

/**
 * Motifs de signalement, alignés sur lib/ai/moderation.ts.
 *
 * Recopiés ici en `String` plutôt qu'en `enum` Mongoose : une relecture
 * qui rendrait un motif inconnu ferait échouer l'enregistrement de tout
 * le lot, alors que le motif est une indication pour l'équipe, pas une
 * donnée dont dépend le fonctionnement du site.
 */

export interface IComment {
  song: Types.ObjectId;
  user: Types.ObjectId;
  text: string;
  timestampInSong?: number; // secondes — commentaire ancré à un moment du son
  parentComment?: Types.ObjectId; // pour les réponses
  sentiment?: Sentiment; // calculé après création (analyse de sentiment)
  sentimentScore?: number; // -1 à 1
  /**
   * Instant de la relecture par l'IA. Son absence est ce qui met un
   * commentaire dans la file d'attente — pas un statut « pending » qu'il
   * faudrait penser à écrire à chaque création, et qui manquerait donc à
   * tous les commentaires déjà en base.
   */
  moderatedAt?: Date;
  /** Signalé à l'équipe. Le commentaire reste visible : voir lib/ai/moderation.ts. */
  flagged: boolean;
  flagLabels?: string[];
  /** Une phrase expliquant à l'équipe ce qui pose problème. */
  flagNote?: string;
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
  moderatedAt: { type: Date },
  flagged: { type: Boolean, default: false },
  flagLabels: { type: [String], default: undefined },
  flagNote: { type: String, maxlength: 300 },
  likesCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

// La file d'attente de la relecture se lit par cet index : les non
// relus, du plus récent au plus ancien. Sans lui, chaque vidage
// parcourrait toute la collection.
CommentSchema.index({ moderatedAt: 1, createdAt: -1 });
// Les signalés d'abord, c'est la vue qu'ouvre l'équipe.
CommentSchema.index({ flagged: -1, createdAt: -1 });

export default (models.Comment as Model<IComment>) || model<IComment>("Comment", CommentSchema);
