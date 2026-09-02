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

export default (models.Royalty as Model<IRoyalty>) || model<IRoyalty>("Royalty", RoyaltySchema);
