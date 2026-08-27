import { Schema, models, model, Model } from "mongoose";

/**
 * Un rapport hebdomadaire, tel qu'il a été établi ce jour-là.
 *
 * L'écran d'administration recalcule tout à chaque ouverture : c'est un
 * tableau de bord, il doit dire l'état d'aujourd'hui. Ce document sert à
 * autre chose — garder ce qui a été **constaté** au moment où le cron est
 * passé.
 *
 * Sans lui, un rapport ne serait qu'un instantané volatil : impossible de
 * revenir sur ce qu'on savait il y a trois semaines, ni de comparer une
 * interprétation à ce qui s'est réellement produit ensuite. Or c'est
 * précisément l'usage d'un rapport d'exploitation.
 *
 * `mesures` est stocké tel quel, sans schéma détaillé : ce sont des
 * chiffres d'archive, jamais requêtés champ par champ, et figer leur
 * forme obligerait à migrer la collection à chaque métrique ajoutée.
 */
export interface IInsightReport {
  from: Date;
  to: Date;
  libelle: string;
  /** Le rapport complet au moment du calcul (voir lib/insights/report.ts). */
  mesures: Record<string, unknown>;
  /** Lecture de la semaine. Vide quand l'IA n'était pas disponible. */
  lecture: string;
  aRegarder: string[];
  redigeParIA: boolean;
  createdAt: Date;
}

const InsightReportSchema = new Schema<IInsightReport>({
  from: { type: Date, required: true },
  to: { type: Date, required: true },
  libelle: { type: String, default: "" },
  mesures: { type: Schema.Types.Mixed, default: {} },
  lecture: { type: String, default: "" },
  aRegarder: { type: [String], default: [] },
  redigeParIA: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

// Une seule lecture possible : les plus récents d'abord.
InsightReportSchema.index({ createdAt: -1 });
// Un rapport par fenêtre : deux passages du cron la même semaine ne
// doivent pas empiler deux archives du même état.
InsightReportSchema.index({ from: 1, to: 1 }, { unique: true });

export default (models.InsightReport as Model<IInsightReport>) ||
  model<IInsightReport>("InsightReport", InsightReportSchema);
