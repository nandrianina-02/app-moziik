import { Schema, models, model, Types, Model } from "mongoose";

export interface IRoyalty {
  artist: Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  eligiblePlays: number; // écoutes complètes comptabilisées sur la période
  amountUSD: number;
  /**
   * Le passage de calcul dont ce relevé est issu.
   *
   * Relie le relevé aux écoutes qu'il paie (`Play.monetizedRun`) : c'est
   * ce qui permet de retrouver, après un incident, une réservation restée
   * sans relevé.
   */
  run?: Types.ObjectId;
  paid: boolean;
  createdAt: Date;
}

const RoyaltySchema = new Schema<IRoyalty>({
  artist: { type: Schema.Types.ObjectId, ref: "Artist", required: true, index: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  eligiblePlays: { type: Number, required: true },
  amountUSD: { type: Number, required: true },
  run: { type: Schema.Types.ObjectId, index: true },
  paid: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

/**
 * Un seul relevé par artiste et par passage de calcul.
 *
 * Le garde-fou est ici plutôt que dans le code : la réservation des
 * écoutes empêche déjà un double paiement, mais c'est une promesse du
 * programme. Celle-ci est tenue par la base.
 *
 * `partialFilterExpression` limite la contrainte aux relevés qui portent
 * un `run` — les anciens n'en ont pas, et sans ce filtre ils
 * partageraient tous la clé `{artist, null}`.
 */
RoyaltySchema.index(
  { artist: 1, run: 1 },
  { unique: true, partialFilterExpression: { run: { $type: "objectId" } } }
);

export default (models.Royalty as Model<IRoyalty>) || model<IRoyalty>("Royalty", RoyaltySchema);
