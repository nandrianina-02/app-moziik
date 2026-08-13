import { Schema, models, model, Model } from "mongoose";

export interface IMonthlyViews {
  month: string; // format "AAAA-MM"
  count: number;
}

export interface IHomepageStats {
  totalViews: number;
  monthlyViews: IMonthlyViews[]; // les 13 derniers mois, pour calculer une tendance
  updatedAt: Date;
}

const HomepageStatsSchema = new Schema<IHomepageStats>({
  totalViews: { type: Number, default: 0 },
  monthlyViews: [
    {
      month: { type: String, required: true },
      count: { type: Number, default: 0 },
    },
  ],
  updatedAt: { type: Date, default: Date.now },
});

export default (models.HomepageStats as Model<IHomepageStats>) ||
  model<IHomepageStats>("HomepageStats", HomepageStatsSchema);
