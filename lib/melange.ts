/**
 * Ordre mélangé d'une liste de titres, pour les pages de genre.
 *
 * Trié par date de sortie, un genre se lit album par album : les titres
 * d'un même album partagent la même date et arrivent en bloc. Le mélange
 * casse ces blocs, et doit rester le même d'une page à l'autre du
 * défilement infini : il dépend d'une graine fournie par le client, tirée
 * une fois à l'ouverture de la page.
 */

/** Générateur pseudo-aléatoire déterministe (mulberry32) : même graine, même suite. */
export function hasardDe(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Mélange `elements`, puis écarte autant que possible deux voisins de même
 * clé (le même artiste) : un tirage au hasard en aligne souvent deux, et
 * c'est justement l'impression de liste groupée qu'on veut éviter.
 */
export function melangerSansVoisins<T>(elements: T[], cle: (e: T) => string, hasard: () => number): T[] {
  const liste = [...elements];
  for (let i = liste.length - 1; i > 0; i--) {
    const j = Math.floor(hasard() * (i + 1));
    [liste[i], liste[j]] = [liste[j], liste[i]];
  }
  for (let i = 1; i < liste.length; i++) {
    if (cle(liste[i]) !== cle(liste[i - 1])) continue;
    // Le premier élément plus loin qui ne répète pas l'artiste précédent prend la place.
    const k = liste.findIndex((e, n) => n > i && cle(e) !== cle(liste[i - 1]));
    if (k > 0) [liste[i], liste[k]] = [liste[k], liste[i]];
  }
  return liste;
}
