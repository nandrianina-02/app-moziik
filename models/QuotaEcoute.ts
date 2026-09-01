import { Schema, models, model, Model } from "mongoose";

/**
 * Le compteur d'écoutes d'un visiteur non connecté, pour la journée.
 *
 * Pourquoi un modèle à part plutôt qu'un champ sur `Play` : ce ne sont pas
 * les mêmes données. `Play` enregistre une écoute *après coup* et alimente
 * les royalties, les classements et l'historique — elle se conserve. Ceci
 * est une autorisation *avant* lecture, indexée sur une adresse IP, et qui
 * doit disparaître au bout de la journée. Mêler les deux ferait entrer un
 * identifiant réseau dans la chaîne de paiement des artistes et l'y
 * garderait indéfiniment.
 *
 * L'adresse n'est jamais stockée en clair : seule une empreinte salée
 * l'est, et l'index TTL efface le document passé son échéance.
 */
export interface IQuotaEcoute {
  /** sha256(ip + jour + secret) — non réversible, et change chaque jour. */
  cle: string;
  /**
   * Les titres déjà décomptés aujourd'hui.
   *
   * Une liste plutôt qu'un nombre : réécouter le même morceau ne doit pas
   * consommer une seconde unité, sans quoi une lecture en boucle épuiserait
   * le quota en trois minutes.
   */
  titres: string[];
  expireAt: Date;
}

const QuotaEcouteSchema = new Schema<IQuotaEcoute>({
  cle: { type: String, required: true, unique: true },
  titres: { type: [String], default: [] },
  expireAt: { type: Date, required: true },
});

// MongoDB efface le document de lui-même à l'échéance : aucune tâche
// planifiée à prévoir, et rien ne subsiste au-delà de la journée comptée.
QuotaEcouteSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export default (models.QuotaEcoute as Model<IQuotaEcoute>) ||
  model<IQuotaEcoute>("QuotaEcoute", QuotaEcouteSchema);
