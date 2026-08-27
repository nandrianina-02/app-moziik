import HelpArticle from "@/models/HelpArticle";
import { connectDB } from "@/lib/db";
import { motsDe, normaliser } from "@/lib/searchText";

/**
 * Ce que l'assistant a le droit de savoir.
 *
 * L'assistant ne répond qu'à partir des articles du centre d'aide, jamais
 * de ce qu'un modèle croit savoir de Moziik. C'est la seule façon d'être
 * sûr qu'une réponse sur les tarifs, les délais de paiement ou les droits
 * d'un artiste corresponde à ce que ce site pratique réellement — et de
 * pouvoir la corriger : on modifie l'article, pas le code.
 *
 * Le classement se fait en mémoire plutôt qu'en base. Le corpus tient en
 * quelques dizaines d'articles, et « combien de mots de la question
 * apparaissent, et à quel endroit » n'est pas exprimable en une requête
 * MongoDB sans index plein texte — index dont la racinisation française
 * ferait par ailleurs manquer « paiement » dans « paiements ».
 */

/** Articles retenus par défaut : de quoi couvrir une question, pas d'y noyer le modèle. */
const RETENUS = 5;
/** Un article long est tronqué : la réponse tient dans ses premiers paragraphes. */
const CORPS_MAX = 1800;

export type ArticleRetenu = {
  titre: string;
  slug: string;
  categorie: string;
  corps: string;
};

/** Un mot de la question compte plus dans un titre que noyé dans un corps. */
const POIDS = { titre: 4, categorie: 3, resume: 2, corps: 1 };

export async function articlesPertinents(question: string, limite = RETENUS): Promise<ArticleRetenu[]> {
  await connectDB();

  const articles = await HelpArticle.find({ published: true })
    .select("title slug category excerpt body")
    .limit(200)
    .lean();
  if (articles.length === 0) return [];

  const mots = motsDe(question).filter((m) => m.length >= 3);

  // Question sans mot exploitable (« bonjour ? ») : on donne les premiers
  // articles plutôt que rien — le modèle a au moins de quoi orienter.
  if (mots.length === 0) return articles.slice(0, limite).map(enArticleRetenu);

  const notes = articles.map((a) => {
    const titre = normaliser(a.title ?? "");
    const categorie = normaliser(a.category ?? "");
    const resume = normaliser(a.excerpt ?? "");
    const corps = normaliser(a.body ?? "");
    let note = 0;
    for (const mot of mots) {
      if (titre.includes(mot)) note += POIDS.titre;
      if (categorie.includes(mot)) note += POIDS.categorie;
      if (resume.includes(mot)) note += POIDS.resume;
      if (corps.includes(mot)) note += POIDS.corps;
    }
    return { a, note };
  });

  const retenus = notes
    .filter((n) => n.note > 0)
    .sort((x, y) => y.note - x.note)
    .slice(0, limite);

  // Aucun article ne parle du sujet : on n'invente pas une pertinence.
  // L'assistant dira qu'il ne sait pas, ce qui est la bonne réponse.
  return retenus.map((n) => enArticleRetenu(n.a));
}

function enArticleRetenu(a: {
  title?: string;
  slug?: string;
  category?: string;
  body?: string;
}): ArticleRetenu {
  const corps = (a.body ?? "").trim();
  return {
    titre: a.title ?? "",
    slug: a.slug ?? "",
    categorie: a.category ?? "",
    corps: corps.length > CORPS_MAX ? corps.slice(0, CORPS_MAX).trimEnd() + "…" : corps,
  };
}

/** Mise en forme des articles pour le message système. */
export function articlesEnTexte(articles: ArticleRetenu[]): string {
  if (articles.length === 0) return "(Aucun article du centre d'aide ne traite de cette question.)";
  return articles
    .map((a) => `### ${a.titre}\nCatégorie : ${a.categorie}\nLien : /aide/${a.slug}\n\n${a.corps}`)
    .join("\n\n---\n\n");
}
