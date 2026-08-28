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
  lastMessageFrom: "user" | "admin" | "ai";
  unreadForAdmin: number;
  unreadForUser: number;
  /**
   * Le membre a demandé quelqu'un — ou l'assistant a reconnu qu'il ne
   * savait pas. L'assistant se tait alors définitivement sur ce fil, et
   * celui-ci passe devant tous les autres dans la boîte de l'équipe.
   *
   * Définitif, et non « jusqu'à la prochaine question » : quelqu'un qui a
   * demandé un humain vient d'essuyer un échec, lui réservir une machine
   * au message suivant est le meilleur moyen de le perdre.
   */
  humanRequested: boolean;
  /** Dernière fois que l'assistant a répondu sur ce fil. */
  aiRepliedAt?: Date;
  /**
   * Message auquel l'assistant a déjà répondu — ou s'apprête à répondre.
   *
   * Réservé avant l'appel au modèle, pas après : l'appel dure quelques
   * secondes, et deux onglets ouverts sur le même fil produiraient sinon
   * deux réponses à la même question. Relâché si l'appel échoue.
   */
  aiAnsweredMessage?: Types.ObjectId;
  /**
   * Tri automatique du fil : urgence, objet, et signalement éventuel.
   *
   * `triageAt` retient le moment du dernier classement. Tant qu'il est
   * postérieur à `lastMessageAt`, il n'y a rien à reclasser — c'est ce
   * qui évite de repayer un appel à chaque ouverture de la boîte.
   */
  urgence?: "haute" | "normale" | "basse";
  categorie?: string;
  /** Le message du membre s'en prend à quelqu'un, ou n'a rien à faire ici. */
  signale?: boolean;
  /** Ce qui a motivé le signalement, pour l'équipe. */
  motifSignalement?: string;
  triageAt?: Date;
  createdAt: Date;
}

const SupportThreadSchema = new Schema<ISupportThread>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  userName: { type: String, default: "" },
  userEmail: { type: String, default: "" },
  status: { type: String, enum: ["open", "closed"], default: "open", index: true },
  lastMessageAt: { type: Date, default: Date.now, index: true },
  lastMessagePreview: { type: String, default: "" },
  lastMessageFrom: { type: String, enum: ["user", "admin", "ai"], default: "user" },
  unreadForAdmin: { type: Number, default: 0 },
  unreadForUser: { type: Number, default: 0 },
  humanRequested: { type: Boolean, default: false },
  aiRepliedAt: { type: Date },
  aiAnsweredMessage: { type: Schema.Types.ObjectId, ref: "SupportMessage" },
  urgence: { type: String, enum: ["haute", "normale", "basse"] },
  categorie: { type: String },
  signale: { type: Boolean, default: false },
  motifSignalement: { type: String },
  triageAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

// La boîte de réception trie sur ces champs à chaque ouverture.
SupportThreadSchema.index({ status: 1, urgence: 1, lastMessageAt: -1 });

export default (models.SupportThread as Model<ISupportThread>) ||
  model<ISupportThread>("SupportThread", SupportThreadSchema);
