import { Schema, models, model, Model } from "mongoose";

/**
 * Consommation de l'IA, agrégée par jour et par fonctionnalité.
 *
 * Un document par (jour, fonctionnalité), incrémenté à chaque appel. On
 * n'enregistre ni le contenu envoyé, ni la réponse : aucune donnée
 * personnelle ne transite par cette collection, seulement des compteurs.
 *
 * Deux usages, et un seul suffirait mal :
 *
 * - Le plafond journalier s'appuie dessus. Sans compteur partagé, une clé
 *   d'API laissée ouverte peut dépenser sans limite ; un compteur en
 *   mémoire ne tiendrait pas sur un déploiement multi-instances, où chaque
 *   instance croirait être seule (même limite que lib/rateLimit.ts, mais
 *   ici le risque est financier, donc la base s'impose).
 * - L'administration affiche ces chiffres. « Combien ça coûte » est la
 *   première question qu'on se pose après avoir branché une IA, et y
 *   répondre depuis les factures du fournisseur ne dit jamais *quelle*
 *   fonctionnalité dépense.
 *
 * `day` est une date UTC au format AAAA-MM-JJ : le plafond se remet donc à
 * zéro à minuit UTC, soit 03 h 00 à Antananarivo. Une chaîne plutôt qu'une
 * Date parce que c'est une clé de regroupement, pas un instant.
 */
export interface IAiUsage {
  day: string;
  feature: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  /** Appels partis mais revenus en erreur — ils ont pu être facturés, ils comptent. */
  errors: number;
  updatedAt: Date;
}

const AiUsageSchema = new Schema<IAiUsage>({
  day: { type: String, required: true },
  feature: { type: String, required: true },
  calls: { type: Number, default: 0 },
  inputTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
  errors: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

// Unique : c'est cette contrainte qui rend l'upsert concurrent sûr, deux
// appels simultanés sur la même case incrémentant le même document au
// lieu d'en créer deux.
AiUsageSchema.index({ day: 1, feature: 1 }, { unique: true });

export default (models.AiUsage as Model<IAiUsage>) || model<IAiUsage>("AiUsage", AiUsageSchema);
