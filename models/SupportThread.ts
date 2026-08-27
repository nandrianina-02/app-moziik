import { Schema, models, model, Types, Model } from "mongoose";

/**
 * Discussion entre un membre et le support.
 *
 * Un seul fil par membre, comme dans la plupart des messageries d'aide :
 * ouvrir un fil par question obligerait le visiteur à retrouver le bon
 * avant d'écrire, et l'équipe à recoller l'historique elle-même. Un fil
 * fermé se rouvre tout seul au message suivant.
 *
 * Le fil exige un compte. Un fil anonyme ne pourrait être retrouvé que
 * par un jeton stocké dans le navigateur — donc lisible par la personne
 * suivante sur un appareil partagé, ce que ce projet refuse par ailleurs
 * pour les réponses d'API. Les visiteurs sans compte gardent le
 * formulaire de contact, qui n'a pas ce problème puisqu'il n'affiche
 * jamais l'historique.
 */
export type StatutFil = "open" | "closed";

export interface ISupportThread {
  user: Types.ObjectId;
  /** Recopiés à la création : le fil reste lisible même si le compte est supprimé. */
  userName: string;
  userEmail: string;
  status: StatutFil;
  lastMessageAt: Date;
  /** Début du dernier message, pour la liste de l'administration. */
  lastMessagePreview: string;
  /** Qui a écrit en dernier — l'administration trie sur ce que le membre attend. */
  lastMessageFrom: "user" | "admin";
  unreadForAdmin: number;
  unreadForUser: number;
  createdAt: Date;
}

const SupportThreadSchema = new Schema<ISupportThread>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  userName: { type: String, default: "" },
  userEmail: { type: String, default: "" },
  status: { type: String, enum: ["open", "closed"], default: "open", index: true },
  lastMessageAt: { type: Date, default: Date.now, index: true },
  lastMessagePreview: { type: String, default: "" },
  lastMessageFrom: { type: String, enum: ["user", "admin"], default: "user" },
  unreadForAdmin: { type: Number, default: 0 },
  unreadForUser: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

export default (models.SupportThread as Model<ISupportThread>) ||
  model<ISupportThread>("SupportThread", SupportThreadSchema);
