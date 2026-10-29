import { Schema, models, model, Types, Model } from "mongoose";
import { UNIVERS, type Univers } from "@/lib/univers";

/**
 * Une sélection composée pour un auditeur (lib/selections.ts) : un Mix du
 * jour, ses Découvertes de la semaine ou son Radar des sorties.
 *
 * Elle est gardée pour toute sa période plutôt que recalculée à chaque
 * visite : un Mix du jour ne doit pas changer d'une heure à l'autre, et les
 * Découvertes de la semaine encore moins, alors même que chaque écoute
 * modifie ce que le calcul verrait. La liste reçue le lundi est celle de la
 * semaine. Le document s'efface de lui-même après sa période (index TTL).
 *
 * `user` vaut null pour les sélections d'un visiteur, communes à tous.
 */
export type TypeSelection = "mix" | "decouvertes" | "radar";

export interface ISelectionPersonnelle {
  user: Types.ObjectId | null;
  univers: Univers;
  type: TypeSelection;
  /** Le numéro du mix (1 à 6) ; 0 pour les autres. */
  rang: number;
  /** « 2026-10-29 » pour une sélection du jour, « 2026-S44 » pour une de la semaine. */
  periode: string;
  titre: string;
  description: string;
  genre?: string;
  /** L'image de la pochette (photo de l'artiste principal d'un mix). */
  couverture?: string;
  titres: Types.ObjectId[];
  expireLe: Date;
  createdAt: Date;
}

const SelectionPersonnelleSchema = new Schema<ISelectionPersonnelle>({
  user: { type: Schema.Types.ObjectId, ref: "User", default: null },
  univers: { type: String, enum: UNIVERS, required: true },
  type: { type: String, enum: ["mix", "decouvertes", "radar"], required: true },
  rang: { type: Number, default: 0 },
  periode: { type: String, required: true },
  titre: { type: String, required: true },
  description: { type: String, default: "" },
  genre: { type: String },
  couverture: { type: String },
  titres: [{ type: Schema.Types.ObjectId, ref: "Song" }],
  expireLe: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

SelectionPersonnelleSchema.index({ user: 1, univers: 1, type: 1, rang: 1, periode: 1 }, { unique: true });
SelectionPersonnelleSchema.index({ expireLe: 1 }, { expireAfterSeconds: 0 });

export default (models.SelectionPersonnelle as Model<ISelectionPersonnelle>) ||
  model<ISelectionPersonnelle>("SelectionPersonnelle", SelectionPersonnelleSchema);
