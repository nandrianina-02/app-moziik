import { Schema, models, model, Model } from "mongoose";

/**
 * Ce que le public cherche, agrégé par jour.
 *
 * Sert à une seule chose : la playlist « Les plus recherchés » de la
 * curation hebdomadaire (lib/curation/). Sans ce journal, cette playlist
 * n'a aucune source — rien dans le projet ne conservait les saisies, et
 * lib/recentSearches.ts ne vit que dans le navigateur de chacun.
 *
 * CE QUI N'EST PAS ENREGISTRÉ, ET POURQUOI
 *
 * Ni le compte, ni l'adresse IP, ni l'horodatage précis. Un compteur par
 * saisie et par jour suffit à établir un classement ; y attacher une
 * identité en ferait un historique de recherche nominatif, c'est-à-dire
 * une donnée d'une tout autre nature — que personne n'a demandée et dont
 * la fuite serait autrement plus grave qu'un classement faussé.
 *
 * `terme` est la forme normalisée (minuscules, sans accent) : c'est la
 * clé de regroupement, pour que « Salegy » et « salegy » comptent
 * ensemble. `libelle` garde la dernière forme réellement saisie, seule
 * présentable à l'écran.
 */
export interface ISearchQuery {
  /** Jour UTC au format AAAA-MM-JJ. */
  day: string;
  /** Saisie normalisée : clé de regroupement. */
  term: string;
  /** Dernière forme saisie, pour l'affichage. */
  label: string;
  count: number;
  updatedAt: Date;
}

const SearchQuerySchema = new Schema<ISearchQuery>({
  day: { type: String, required: true },
  term: { type: String, required: true },
  label: { type: String, required: true },
  count: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

SearchQuerySchema.index({ day: 1, term: 1 }, { unique: true });
// Classement d'une période : on balaie les jours de la fenêtre, les plus
// demandés d'abord.
SearchQuerySchema.index({ day: -1, count: -1 });

export default (models.SearchQuery as Model<ISearchQuery>) ||
  model<ISearchQuery>("SearchQuery", SearchQuerySchema);
