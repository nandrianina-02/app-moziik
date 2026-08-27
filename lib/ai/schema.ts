import { z } from "zod";

/**
 * Bornes tolérantes pour les réponses du modèle.
 *
 * Un plafond de longueur exprimé avec `.max()` **refuse** la valeur. Sur
 * une réponse structurée, refuser un champ refuse tout l'objet : une
 * phrase d'explication de 305 caractères a fait perdre une playlist
 * entière, morceaux compris. C'est arrivé, et c'est ce que ce fichier
 * empêche.
 *
 * Le plafond reste utile — il borne ce qu'on affiche et ce qu'on
 * enregistre — mais il s'applique par troncature, pas par rejet. Il
 * continue d'être publié au modèle dans le schéma de l'outil, donc il
 * garde sa valeur d'indication.
 *
 * Ce qui reste strict, et doit le rester : les énumérations (un genre
 * hors catalogue ne remplirait rien), les booléens, les nombres. Ce sont
 * des valeurs dont le sens dépend de leur exactitude, pas de leur taille.
 */

/**
 * Coupe à `max` sans casser un mot, et sans laisser de ponctuation
 * orpheline.
 *
 * Les points de suspension sont comptés DANS la limite : les ajouter
 * après une coupe à `max` rendait une chaîne de `max + 1` caractères,
 * que le plafond refusait ensuite — et seulement quand le texte ne
 * portait pas d'espace dans son dernier tiers, donc de façon
 * intermittente.
 */
export function couperNet(texte: string, max: number): string {
  const plat = texte.trim();
  if (plat.length <= max) return plat;
  const coupe = plat.slice(0, Math.max(1, max - 1));
  const dernierEspace = coupe.lastIndexOf(" ");
  const garde = dernierEspace > max * 0.6 ? coupe.slice(0, dernierEspace) : coupe;
  return garde.replace(/[\s,;:.—-]+$/, "") + "…";
}

/**
 * Texte facultatif, tronqué à `max`.
 *
 * Pour tout ce qui explique, commente ou résume : son absence comme son
 * débordement ne doivent jamais emporter le reste de la réponse.
 */
export function texteAccessoire(max: number) {
  // `preprocess` et non `transform` : la troncature a lieu AVANT la
  // validation, si bien que `.max()` ne refuse jamais rien tout en restant
  // dans le schema publie au modele. Avec `transform`, le plafond
  // disparaissait du JSON Schema et le modele perdait l'indication.
  return z
    .preprocess((v) => (typeof v === "string" ? couperNet(v, max) : v), z.string().max(max))
    .default("");
}

/**
 * Texte attendu, non vide, tronqué à `max`.
 *
 * Pour ce qui porte le résultat : une biographie, un corps d'article, une
 * réponse au membre. Vide, il n'y a rien à montrer — c'est le seul cas où
 * refuser a du sens.
 */
export function texteRequis(max: number) {
  return z.preprocess(
    (v) => (typeof v === "string" ? couperNet(v, max) : v),
    z.string().min(1).max(max)
  );
}

/** Liste tronquée à `max` éléments, jamais refusée pour sa taille. */
export function listeBornee<T extends z.ZodTypeAny>(element: T, max: number) {
  return z
    .preprocess((v) => (Array.isArray(v) ? v.slice(0, max) : v), z.array(element).max(max))
    .default([] as z.infer<T>[]);
}
