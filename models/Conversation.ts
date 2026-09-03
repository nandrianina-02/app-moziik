import { Schema, models, model, Types, Model } from "mongoose";
import type { TypeConversation } from "@/lib/messagerie";

/**
 * Une conversation, à deux ou à plusieurs.
 *
 * UN SEUL MODÈLE POUR LES DEUX FORMES
 *
 * Un tête-à-tête est un groupe de deux : lui donner son propre modèle
 * dupliquerait la liste, les compteurs de non-lus, la mise en sourdine et
 * la lecture des messages, pour ne gagner qu'un champ `title` en moins.
 * `type` suffit à distinguer ce qui diffère vraiment — un groupe a un nom
 * et des gestionnaires, un tête-à-tête emprunte son nom à l'autre.
 *
 * POURQUOI `directKey`
 *
 * Deux personnes ne doivent avoir qu'une conversation, même si elles
 * cliquent « écrire » en même temps depuis deux appareils. Chercher un
 * fil existant avant d'en créer un ne suffit pas : entre la lecture et
 * l'écriture, l'autre appareil a le temps de créer le sien. La clé est
 * donc l'index unique lui-même, formé des deux identifiants triés — la
 * base refuse le doublon, et l'appelant récupère le fil existant.
 *
 * LES COMPTEURS DE NON-LUS SONT DES COMPTEURS
 *
 * Ils sont incrémentés à l'envoi et remis à zéro à la lecture, plutôt que
 * recalculés à chaque affichage. Compter les messages postérieurs à
 * `lastReadAt` demanderait une requête par conversation à chaque
 * ouverture de la liste ; c'est le choix déjà fait pour les fils de
 * support, et il tient pour la même raison.
 */

export interface IParticipant {
  user: Types.ObjectId;
  /** Peut renommer le groupe, ajouter et exclure. Toujours vrai à deux. */
  manager: boolean;
  joinedAt: Date;
  lastReadAt: Date;
  unread: number;
  /** Plus de notification pour ce fil ; les messages arrivent quand même. */
  muted: boolean;
  /**
   * Dernier signe de frappe.
   *
   * Posé par le client pendant qu'il écrit, relu par les autres à chaque
   * rafraîchissement. Il n'y a rien à éteindre : une date qui vieillit
   * cesse d'elle-même de vouloir dire « écrit en ce moment »
   * (FENETRE_SAISIE_MS), là où un booléen resterait allumé pour toujours
   * si l'onglet se fermait au mauvais moment.
   */
  typingAt?: Date;
  /**
   * Sortie du groupe, sans effacer l'historique des autres.
   *
   * Un participant retiré du tableau ferait disparaître son nom des
   * anciens messages et rendrait le fil illisible pour ceux qui restent.
   */
  leftAt?: Date;
}

export interface IConversation {
  type: TypeConversation;
  participants: IParticipant[];
  /** Groupes seulement. */
  title?: string;
  coverUrl?: string;
  createdBy: Types.ObjectId;
  lastMessageAt: Date;
  lastMessagePreview: string;
  lastMessageFrom?: Types.ObjectId;
  /** `<idA>:<idB>` triés — présent sur les tête-à-tête, absent sur les groupes. */
  directKey?: string;
  createdAt: Date;
}

const ParticipantSchema = new Schema<IParticipant>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    manager: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now },
    lastReadAt: { type: Date, default: Date.now },
    unread: { type: Number, default: 0 },
    muted: { type: Boolean, default: false },
    typingAt: { type: Date },
    leftAt: { type: Date },
  },
  { _id: false }
);

const ConversationSchema = new Schema<IConversation>({
  type: { type: String, enum: ["direct", "group", "assistant"], required: true },
  participants: { type: [ParticipantSchema], default: [] },
  title: { type: String, maxlength: 60 },
  coverUrl: { type: String },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  lastMessageAt: { type: Date, default: Date.now, index: true },
  lastMessagePreview: { type: String, default: "" },
  lastMessageFrom: { type: Schema.Types.ObjectId, ref: "User" },
  directKey: { type: String },
  createdAt: { type: Date, default: Date.now },
});

/** La liste se lit toujours « mes conversations, la plus récente d'abord ». */
ConversationSchema.index({ "participants.user": 1, lastMessageAt: -1 });

// Unique, mais seulement là où la clé existe : les groupes n'en ont pas,
// et un index unique simple les ferait tous entrer en collision sur
// `null` — exactement le genre d'index périmé qui a déjà bloqué les
// relevés de droits de ce projet.
ConversationSchema.index(
  { directKey: 1 },
  { unique: true, partialFilterExpression: { directKey: { $type: "string" } } }
);

/** La clé d'un tête-à-tête : les deux identifiants triés, donc symétrique. */
export function cleDirecte(a: string, b: string): string {
  return [String(a), String(b)].sort().join(":");
}

export default (models.Conversation as Model<IConversation>) ||
  model<IConversation>("Conversation", ConversationSchema);
