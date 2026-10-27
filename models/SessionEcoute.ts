import { Schema, models, model, Types, Model } from "mongoose";

/**
 * Une écoute à plusieurs : un hôte joue, les invités entendent la même
 * chose au même moment. Le serveur ne garde que l'état de la lecture de
 * l'hôte (titre, position au moment de la mise à jour, lecture ou pause) ;
 * chaque invité recalcule la position courante à partir de `majLe`.
 *
 * La session s'efface d'elle-même six heures après la dernière mise à jour
 * de l'hôte (index TTL sur `expireLe`) : une session oubliée ne traîne pas.
 */
export interface ISessionEcoute {
  code: string;
  hote: Types.ObjectId;
  titre?: Types.ObjectId;
  positionMs: number;
  enLecture: boolean;
  majLe: Date;
  participants: { user: Types.ObjectId; vuLe: Date }[];
  expireLe: Date;
  createdAt: Date;
}

const SessionEcouteSchema = new Schema<ISessionEcoute>({
  code: { type: String, required: true, unique: true },
  hote: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  titre: { type: Schema.Types.ObjectId, ref: "Song" },
  positionMs: { type: Number, default: 0 },
  enLecture: { type: Boolean, default: false },
  majLe: { type: Date, default: Date.now },
  participants: [
    {
      _id: false,
      user: { type: Schema.Types.ObjectId, ref: "User", required: true },
      vuLe: { type: Date, default: Date.now },
    },
  ],
  expireLe: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

SessionEcouteSchema.index({ expireLe: 1 }, { expireAfterSeconds: 0 });

export default (models.SessionEcoute as Model<ISessionEcoute>) || model<ISessionEcoute>("SessionEcoute", SessionEcouteSchema);
