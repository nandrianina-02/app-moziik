import { Schema, models, model, Types, Model } from "mongoose";

/**
 * Une analyse hebdomadaire : ce qu'elle a mesuré, ce qu'elle a proposé,
 * ce qu'on en a fait.
 *
 * Ce document existe pour une raison précise : les playlists produites ne
 * disent pas d'où elles viennent. Sans trace de la fenêtre analysée et
 * des volumes mesurés, personne ne peut répondre à « pourquoi ce
 * titre-là », ni distinguer une semaine creuse d'une panne de collecte.
 *
 * Il porte aussi l'état de validation. Le passage de `a_valider` à
 * `publiee` est le seul moment où quelque chose devient visible du
 * public : le reste du temps, une analyse est un brouillon sans effet.
 */

export type StatutRun = "en_cours" | "a_valider" | "publiee" | "annulee" | "echouee";

/** Ce qui a été mesuré sur la fenêtre. Sert à expliquer, pas à décider. */
export interface IStatsRun {
  ecoutes: number;
  auditeurs: number;
  recherches: number;
  nouveautes: number;
  titresConsideres: number;
}

export interface ICurationRun {
  /** Fenêtre analysée : `from` inclus, `to` exclu. */
  from: Date;
  to: Date;
  statut: StatutRun;
  /** `cron` pour l'exécution hebdomadaire, `admin` pour un lancement manuel. */
  declencheur: "cron" | "admin";
  /** Compte ayant lancé l'analyse — propriétaire des playlists produites. */
  lancePar?: Types.ObjectId;
  stats: IStatsRun;
  /** Titre proposé pour la section d'accueil. */
  titreSection: string;
  /** Synthèse de la semaine, affichée en administration. */
  resume: string;
  /** Vrai si les textes viennent du modèle, faux s'ils sont ceux de repli. */
  redigeParIA: boolean;
  /** Message d'échec, quand `statut` vaut `echouee`. */
  erreur?: string;
  publieeLe?: Date;
  /** Compte ayant validé la publication. */
  publieePar?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CurationRunSchema = new Schema<ICurationRun>({
  from: { type: Date, required: true },
  to: { type: Date, required: true },
  statut: {
    type: String,
    enum: ["en_cours", "a_valider", "publiee", "annulee", "echouee"],
    default: "en_cours",
  },
  declencheur: { type: String, enum: ["cron", "admin"], default: "cron" },
  lancePar: { type: Schema.Types.ObjectId, ref: "User" },
  stats: {
    ecoutes: { type: Number, default: 0 },
    auditeurs: { type: Number, default: 0 },
    recherches: { type: Number, default: 0 },
    nouveautes: { type: Number, default: 0 },
    titresConsideres: { type: Number, default: 0 },
  },
  titreSection: { type: String, default: "" },
  resume: { type: String, default: "" },
  redigeParIA: { type: Boolean, default: false },
  erreur: { type: String },
  publieeLe: { type: Date },
  publieePar: { type: Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// L'écran d'administration lit toujours la même chose : la dernière
// analyse, puis les précédentes.
CurationRunSchema.index({ createdAt: -1 });
CurationRunSchema.index({ statut: 1, createdAt: -1 });

export default (models.CurationRun as Model<ICurationRun>) ||
  model<ICurationRun>("CurationRun", CurationRunSchema);
