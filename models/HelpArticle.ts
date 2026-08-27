import { Schema, models, model, Model } from "mongoose";

/**
 * Article du centre d'aide.
 *
 * Le contenu est en base plutôt que dans le code, comme les genres, les
 * sections d'accueil et les mentions légales : corriger une réponse ne
 * doit pas demander un déploiement.
 *
 * `body` est du texte brut avec des sauts de ligne — pas du HTML. Il est
 * rendu tel quel, paragraphe par paragraphe : accepter du HTML saisi en
 * administration ouvrirait une injection sur une page publique pour un
 * gain de mise en forme dont le support n'a pas besoin.
 */
export interface IHelpArticle {
  title: string;
  slug: string;
  category: string;
  /** Résumé affiché dans la liste ; déduit du corps s'il est laissé vide. */
  excerpt: string;
  body: string;
  /** Ordre d'affichage dans sa catégorie, croissant. */
  position: number;
  published: boolean;
  /** Compteur de consultations, pour remonter les articles utiles. */
  views: number;
  createdAt: Date;
  updatedAt: Date;
}

const HelpArticleSchema = new Schema<IHelpArticle>({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  slug: { type: String, required: true, unique: true, index: true },
  category: { type: String, required: true, trim: true, maxlength: 60, index: true },
  excerpt: { type: String, default: "", maxlength: 300 },
  body: { type: String, required: true, maxlength: 20000 },
  position: { type: Number, default: 0 },
  published: { type: Boolean, default: true, index: true },
  views: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

HelpArticleSchema.index({ category: 1, position: 1 });

export default (models.HelpArticle as Model<IHelpArticle>) ||
  model<IHelpArticle>("HelpArticle", HelpArticleSchema);
