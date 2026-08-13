import { Schema, models, model, Types, Model } from "mongoose";

export type SubscriptionPlan = "free" | "premium" | "premium_annual";
export type PaymentMethod = "stripe" | "mobile_money";
export type SubscriptionStatus = "active" | "canceled" | "past_due" | "expired";

export interface ISubscription {
  user: Types.ObjectId;
  plan: SubscriptionPlan;
  amount: number;
  currency: string; // "USD" | "EUR" | "MGA" ...
  paymentMethod: PaymentMethod;
  region: string; // pays de facturation, détermine le mode de paiement proposé
  status: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  mobileMoneyReference?: string;
  // Identifiant retourné par MVola à l'initiation (distinct de notre
  // propre `mobileMoneyReference`) : sert à revérifier le statut réel
  // de la transaction auprès de MVola plutôt que de faire confiance au
  // contenu du webhook entrant.
  mvolaServerCorrelationId?: string;
  startedAt: Date;
  currentPeriodEnd: Date;
}

const SubscriptionSchema = new Schema<ISubscription>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  plan: { type: String, enum: ["free", "premium", "premium_annual"], default: "free" },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  paymentMethod: { type: String, enum: ["stripe", "mobile_money"], required: true },
  region: { type: String, required: true },
  status: { type: String, enum: ["active", "canceled", "past_due", "expired"], default: "active" },
  stripeCustomerId: { type: String },
  stripeSubscriptionId: { type: String },
  mobileMoneyReference: { type: String },
  mvolaServerCorrelationId: { type: String },
  startedAt: { type: Date, default: Date.now },
  currentPeriodEnd: { type: Date, required: true },
});

export default (models.Subscription as Model<ISubscription>) || model<ISubscription>("Subscription", SubscriptionSchema);
