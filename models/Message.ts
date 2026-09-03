import { Schema, models, model, Types, Model } from "mongoose";
import { TYPES_PARTAGE, CORPS_MAX, type TypePartage } from "@/lib/messagerie";

/**
 * Un message dans une conversation.
 *
 * LE CORPS EST DU TEXTE BRUT
 *
 * Rendu paragraphe par paragraphe, jamais interprété comme du HTML. Un
 * message est écrit par quelqu'un d'autre et s'affiche chez soi : c'est
 * la règle déjà posée pour les fils de support, et elle ne souffre pas
 * d'exception ici, où l'expéditeur peut être un inconnu.
 *
 * LE CONTENU PARTAGÉ EST RECOPIÉ, PAS RÉFÉRENCÉ
 *
 * Titre, sous-titre et image sont figés à l'envoi. Une conversation est
 * une archive : un morceau retiré du catalogue ne doit pas vider une
 * carte échangée il y a six mois. `refId` garde le lien, qui lui a le
 * droit de ne plus mener nulle part — et la carte le dit alors.
 *
 * LA CITATION AUSSI
 *
 * Répondre garde l'identifiant du message cité, mais aussi le nom de son
 * auteur et un extrait. Sans cela, chaque page de messages demanderait
 * une seconde requête pour reconstituer les entêtes de réponse, et un
 * message supprimé viderait la réponse qui le citait.
 *
 * LA SUPPRESSION EST DOUCE
 *
 * Le corps est effacé, le document reste. Retirer la ligne décalerait la
 * pagination des autres lecteurs en pleine lecture, et ferait disparaître
 * les réponses qui s'y rattachent sans laisser de trace de ce qui s'est
 * passé.
 */

export interface IPartageMessage {
  type: TypePartage;
  refId: string;
  titre: string;
  sousTitre?: string;
  imageUrl?: string;
  chemin: string;
}

export interface ICitationMessage {
  messageId: Types.ObjectId;
  auteurNom: string;
  extrait: string;
}

export interface IReactionMessage {
  user: Types.ObjectId;
  emoji: string;
}

export interface IMessage {
  conversation: Types.ObjectId;
  author: Types.ObjectId;
  body: string;
  partage?: IPartageMessage;
  citation?: ICitationMessage;
  reactions: IReactionMessage[];
  editedAt?: Date;
  deletedAt?: Date;
  /**
   * Dernier changement postérieur à l'écriture : réaction, correction,
   * suppression.
   *
   * Le rafraîchissement périodique ne demande que ce qui a bougé depuis
   * sa dernière visite. Sans ce champ, il ne verrait que les messages
   * nouveaux — une réaction posée sur une bulle déjà à l'écran
   * n'apparaîtrait jamais chez les autres, et il faudrait recharger la
   * conversation entière pour s'en apercevoir.
   */
  touchedAt?: Date;
  createdAt: Date;
}

const PartageSchema = new Schema<IPartageMessage>(
  {
    type: { type: String, enum: TYPES_PARTAGE, required: true },
    refId: { type: String, required: true },
    titre: { type: String, required: true },
    sousTitre: { type: String },
    imageUrl: { type: String },
    chemin: { type: String, required: true },
  },
  { _id: false }
);

const CitationSchema = new Schema<ICitationMessage>(
  {
    messageId: { type: Schema.Types.ObjectId, ref: "Message", required: true },
    auteurNom: { type: String, default: "" },
    extrait: { type: String, default: "" },
  },
  { _id: false }
);

const ReactionSchema = new Schema<IReactionMessage>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    emoji: { type: String, required: true, maxlength: 16 },
  },
  { _id: false }
);

const MessageSchema = new Schema<IMessage>({
  conversation: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
  author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  body: { type: String, default: "", maxlength: CORPS_MAX },
  partage: { type: PartageSchema },
  citation: { type: CitationSchema },
  reactions: { type: [ReactionSchema], default: [] },
  editedAt: { type: Date },
  deletedAt: { type: Date },
  touchedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

// Deux lectures, et deux seulement : la page la plus récente d'un fil, et
// ce qui est arrivé depuis le dernier rafraîchissement. Le même index sert
// aux deux.
MessageSchema.index({ conversation: 1, createdAt: -1 });
// Le rafraîchissement demande « ce qui a bougé depuis », toutes
// conversations confondues au sein d'un fil : sans cet index il balaierait
// le fil entier à chaque battement.
MessageSchema.index({ conversation: 1, touchedAt: -1 });

export default (models.Message as Model<IMessage>) || model<IMessage>("Message", MessageSchema);
