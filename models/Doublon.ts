import { Schema, models, model, Types, Model } from "mongoose";

/**
 * Deux titres qui semblent être le même morceau importé deux fois. Les
 * paires sont repérées hors du site, par l'empreinte sonore (deux fichiers
 * presque identiques, de même durée) ou par le titre (même titre, même
 * artiste) ; l'administration tranche (app/admin/doublons).
 *
 * `a` est toujours l'identifiant le plus petit des deux : une paire ne peut
 * être enregistrée qu'une fois, quel que soit l'ordre de sa découverte.
 */
export interface IDoublon {
  a: Types.ObjectId;
  b: Types.ObjectId;
  /** Ressemblance des empreintes (cosinus, 0 à 1), absente pour une paire trouvée par le titre. */
  similarite?: number;
  raison: "empreinte" | "titre";
  statut: "a-traiter" | "distincts" | "resolu";
  /** Le titre gardé, quand la paire est résolue. */
  garde?: Types.ObjectId;
  traiteLe?: Date;
  createdAt: Date;
}

const DoublonSchema = new Schema<IDoublon>({
  a: { type: Schema.Types.ObjectId, ref: "Song", required: true },
  b: { type: Schema.Types.ObjectId, ref: "Song", required: true },
  similarite: { type: Number },
  raison: { type: String, enum: ["empreinte", "titre"], required: true },
  statut: { type: String, enum: ["a-traiter", "distincts", "resolu"], default: "a-traiter", index: true },
  garde: { type: Schema.Types.ObjectId, ref: "Song" },
  traiteLe: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

DoublonSchema.index({ a: 1, b: 1 }, { unique: true });

export default (models.Doublon as Model<IDoublon>) || model<IDoublon>("Doublon", DoublonSchema);
