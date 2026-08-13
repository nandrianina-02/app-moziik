import { Schema, models, model, Types, Model } from "mongoose";

export interface IRoyalty {
  artist: Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  eligiblePlays: number; // écoutes complètes comptabilisées sur la période
  amountUSD: number;
  paid: boolean;
  createdAt: Date;
}

const RoyaltySchema = new Schema<IRoyalty>({
  artist: { type: Schema.Types.ObjectId, ref: "Artist", required: true, index: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  eligiblePlays: { type: Number, required: true },
  amountUSD: { type: Number, required: true },
  paid: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default (models.Royalty as Model<IRoyalty>) || model<IRoyalty>("Royalty", RoyaltySchema);
