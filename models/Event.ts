import { Schema, models, model, Types, Model } from "mongoose";

export type EventStatus = "pending" | "published" | "rejected";

export interface IEvent {
  title: string;
  description: string;
  coverUrl?: string;
  location: string;
  date: Date;
  ticketUrl?: string;
  price?: number;
  createdBy: Types.ObjectId; // ref User (admin ou artiste autorisé)
  artist?: Types.ObjectId; // ref Artist, si porté par un artiste
  status: EventStatus; // les évènements d'artistes passent par une validation admin
  approvedBy?: Types.ObjectId;
  createdAt: Date;
}

const EventSchema = new Schema<IEvent>({
  title: { type: String, required: true },
  description: { type: String, required: true },
  coverUrl: { type: String },
  location: { type: String, required: true },
  date: { type: Date, required: true },
  ticketUrl: { type: String },
  price: { type: Number },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  artist: { type: Schema.Types.ObjectId, ref: "Artist", index: true },
  status: { type: String, enum: ["pending", "published", "rejected"], default: "pending" },
  approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

// Requête la plus fréquente de tout le projet pour ce modèle : les
// évènements publiés à venir, triés par date (page évènements, moteur
// de la page d'accueil, radio). La modération admin filtre aussi par
// status seul ("pending"), déjà couvert par le préfixe de cet index.
EventSchema.index({ status: 1, date: 1 });

export default (models.Event as Model<IEvent>) || model<IEvent>("Event", EventSchema);
