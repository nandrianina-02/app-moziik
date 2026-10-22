import { Schema, models, model, Types, Model } from "mongoose";

/**
 * Un téléphone qui reçoit les notifications push d'un compte (app native,
 * Firebase Cloud Messaging). Le jeton est celui que Firebase donne à
 * l'installation de l'app : il change parfois, et un même téléphone peut
 * passer d'un compte à l'autre — d'où l'unicité sur le jeton, pas sur le
 * compte.
 */
export interface IAppareilPush {
  user: Types.ObjectId;
  jeton: string;
  plateforme: "android";
  vuLe: Date;
  createdAt: Date;
}

const AppareilPushSchema = new Schema<IAppareilPush>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  jeton: { type: String, required: true, unique: true },
  plateforme: { type: String, enum: ["android"], default: "android" },
  vuLe: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

export default (models.AppareilPush as Model<IAppareilPush>) || model<IAppareilPush>("AppareilPush", AppareilPushSchema);
