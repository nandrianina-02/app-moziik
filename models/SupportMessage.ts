import { Schema, models, model, Types, Model } from "mongoose";

/**
 * Un message dans un fil de support.
 *
 * `author` dit de quel côté vient le message, `authorUser` qui l'a
 * réellement écrit : c'est la même information pour un membre, mais pas
 * pour l'équipe, où plusieurs administrateurs répondent sur le même fil.
 *
 * L'assistant est un troisième auteur, et non un administrateur d'un
 * genre particulier. Les confondre coûterait deux fois : le membre ne
 * saurait pas qu'il parle à une machine, et l'équipe ne pourrait plus
 * distinguer, dans un fil, ce qu'elle a écrit de ce qui a été répondu en
 * son nom.
 *
 * Le corps est du texte brut, rendu paragraphe par paragraphe. Aucune
 * interprétation HTML : un message est écrit par un inconnu et s'affiche
 * dans le navigateur de l'équipe.
 */
export interface ISupportMessage {
  thread: Types.ObjectId;
  author: "user" | "admin" | "ai";
  authorUser?: Types.ObjectId;
  /** Nom affiché à l'envoi ; fige l'auteur même si le compte change de nom. */
  authorName: string;
  body: string;
  createdAt: Date;
}

const SupportMessageSchema = new Schema<ISupportMessage>({
  thread: { type: Schema.Types.ObjectId, ref: "SupportThread", required: true, index: true },
  author: { type: String, enum: ["user", "admin", "ai"], required: true },
  authorUser: { type: Schema.Types.ObjectId, ref: "User" },
  authorName: { type: String, default: "" },
  body: { type: String, required: true, maxlength: 4000 },
  createdAt: { type: Date, default: Date.now },
});

// Les messages sont toujours lus par fil et dans l'ordre, y compris pour
// le rafraîchissement qui ne demande que ce qui suit un horodatage.
SupportMessageSchema.index({ thread: 1, createdAt: 1 });

export default (models.SupportMessage as Model<ISupportMessage>) ||
  model<ISupportMessage>("SupportMessage", SupportMessageSchema);
