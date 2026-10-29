/**
 * Le calcul d'un Blend, sans base de données : ce qui se teste seul.
 *
 * Un Blend mêle les titres favoris de deux membres. Viennent d'abord les
 * titres que les deux écoutent, puis les favoris de l'un et de l'autre en
 * alternance, pour qu'aucun des deux n'occupe tout le début de la liste.
 */

export type Part = "deux" | "a" | "b";

/**
 * `a` et `b` : identifiants de titres, du plus écouté au moins écouté.
 * Les titres communs sont classés par la somme de leurs deux rangs.
 */
export function melangerBlend(a: string[], b: string[], limite = 50): { id: string; pour: Part }[] {
  const rangA = new Map(a.map((id, i) => [id, i]));
  const rangB = new Map(b.map((id, i) => [id, i]));
  const communs = a
    .filter((id) => rangB.has(id))
    .sort((x, y) => rangA.get(x)! + rangB.get(x)! - (rangA.get(y)! + rangB.get(y)!));

  const resultat: { id: string; pour: Part }[] = communs.map((id) => ({ id, pour: "deux" }));
  const vus = new Set(communs);
  const restesA = a.filter((id) => !vus.has(id));
  const restesB = b.filter((id) => !vus.has(id));
  for (let i = 0; resultat.length < limite && (i < restesA.length || i < restesB.length); i++) {
    if (i < restesA.length) resultat.push({ id: restesA[i], pour: "a" });
    if (resultat.length < limite && i < restesB.length) resultat.push({ id: restesB[i], pour: "b" });
  }
  return resultat.slice(0, limite);
}

/**
 * Goûts en commun, en pourcentage : la part d'artistes partagés parmi les
 * artistes écoutés par l'un ou l'autre (indice de Jaccard). Deux listes
 * vides ne disent rien : 0.
 */
export function correspondance(artistesA: Iterable<string>, artistesB: Iterable<string>): number {
  const A = new Set(artistesA);
  const B = new Set(artistesB);
  const union = new Set([...A, ...B]).size;
  if (union === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return Math.round((inter / union) * 100);
}
