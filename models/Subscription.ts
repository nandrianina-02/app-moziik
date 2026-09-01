import { Schema, models, model, Types, Model } from "mongoose";

export type SubscriptionPlan = "free" | "premium" | "premium_annual";
/** `offert` : accordé par l'administration, sans transaction derrière. */
export type PaymentMethod = "stripe" | "mobile_money" | "offert";
export type SubscriptionStatus = "active" | "canceled" | "past_due" | "expired";

export interface ISubscription {
  user: Types.ObjectId;
  plan: SubscriptionPlan;
  /** Absents pour un accès offert : il n'y a eu ni montant, ni facturation. */
  amount?: number;
  currency?: string; // "USD" | "EUR" | "MGA" ...
  paymentMethod?: PaymentMethod;
  region?: string; // pays de facturation, détermine le mode de paiement proposé
  status: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  mobileMoneyReference?: string;
  // Identifiant retourné par MVola à l'initiation (distinct de notre
  // propre `mobileMoneyReference`) : sert à revérifier le statut réel
  // de la transaction auprès de MVola plutôt que de faire confiance au
  // contenu du webhook entrant.
  mvolaServerCorrelationId?: string;
  /**
   * L'administrateur qui a offert l'accès, quand il l'a été.
   *
   * C'est ce champ, et non `paymentMethod`, qui dit qu'un accès a été
   * accordé à la main : il permet de retrouver qui l'a décidé lorsqu'on
   * s'interroge, des mois plus tard, sur un compte premium sans paiement.
   */
  grantedBy?: Types.ObjectId;
  startedAt: Date;
  /**
   * Fin de l'accès.
   *
   * **Absente veut dire sans échéance** — le cas d'un accès offert à
   * durée illimitée. Inscrire une date lointaine à la place aurait été
   * une fausse information affichée telle quelle dans « Mon compte ».
   */
  currentPeriodEnd?: Date;
}

const SubscriptionSchema = new Schema<ISubscription>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  plan: { type: String, enum: ["free", "premium", "premium_annual"], default: "free" },
  amount: { type: Number },
  currency: { type: String },
  paymentMethod: { type: String, enum: ["stripe", "mobile_money", "offert"] },
  region: { type: String },
  status: { type: String, enum: ["active", "canceled", "past_due", "expired"], default: "active" },
  stripeCustomerId: { type: String },
  stripeSubscriptionId: { type: String },
  mobileMoneyReference: { type: String },
  mvolaServerCorrelationId: { type: String },
  grantedBy: { type: Schema.Types.ObjectId, ref: "User" },
  startedAt: { type: Date, default: Date.now },
  currentPeriodEnd: { type: Date },
});

export default (models.Subscription as Model<ISubscription>) || model<ISubscription>("Subscription", SubscriptionSchema);
