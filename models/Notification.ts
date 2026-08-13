import { Schema, models, model, Types, Model } from "mongoose";

export type NotificationType =
  | "new_song"      // un artiste suivi publie un son
  | "new_follower"  // nouvel abonné
  | "like"          // quelqu'un a aimé un morceau de l'utilisateur
  | "comment"       // commentaire sur un son de l'utilisateur
  | "event"         // nouvel évènement d'un artiste suivi
  | "payment"       // confirmation / échec de paiement
  | "system";       // annonce de la plateforme

export interface INotification {
  recipient: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  link?: string; // ex: /son/:id, /evenements/:id
  imageUrl?: string; // pochette de son/album ou avatar de l'utilisateur à l'origine de l'action
  read: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  recipient: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: {
    type: String,
    enum: ["new_song", "new_follower", "like", "comment", "event", "payment", "system"],
    required: true,
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  link: { type: String },
  imageUrl: { type: String },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default (models.Notification as Model<INotification>) || model<INotification>("Notification", NotificationSchema);
