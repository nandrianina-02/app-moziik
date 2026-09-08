/**
 * Une mémoire courte, par instance, pour les lectures qui ne changent
 * presque jamais.
 *
 * POURQUOI
 *
 * La configuration du site, les réglages de l'accueil et la liste des
 * sections sont relus à chaque requête — la première l'est même à chaque
 * rendu de page, depuis la mise en page racine. Ce sont trois
 * aller-retours vers une base distante, en série et avant tout le reste,
 * pour des documents qu'un administrateur modifie quelques fois par mois.
 * Depuis une fonction serverless, chacun coûte quelques centaines de
 * millisecondes.
 *
 * CE QUE CETTE MÉMOIRE N'EST PAS
 *
 * Un cache partagé. Elle vit dans la mémoire d'une instance : un
 * démarrage à froid ne la trouve pas, et deux instances n'en partagent
 * rien. Elle ne remplace donc pas un cache de données, elle enlève la
 * répétition à l'intérieur d'une instance chaude — ce qui est déjà
 * l'essentiel du trafic.
 *
 * POURQUOI UN DÉLAI SI COURT
 *
 * Une minute. Assez pour couvrir les requêtes d'une même personne en
 * train de naviguer, assez peu pour qu'un changement d'administration
 * apparaisse sans qu'on ait à y penser. Les écritures appellent en plus
 * `oublier()`, ce qui rend le changement immédiat sur l'instance qui l'a
 * fait.
 *
 * CE QU'ON N'Y MET PAS
 *
 * Rien qui dépende de qui regarde, et rien qu'un appelant puisse
 * modifier : la valeur rendue est partagée, la muter reviendrait à la
 * changer pour tout le monde. Le seul appelant qui modifie la
 * configuration du site — la route d'administration — demande
 * explicitement une lecture fraîche.
 */

const DELAI_MS = 60_000;

type Entree<T> = { valeur: Promise<T>; expire: number };

const memoire = new Map<string, Entree<unknown>>();

/**
 * Rend la valeur mémorisée, ou la calcule.
 *
 * C'est la *promesse* qui est gardée, pas son résultat : deux requêtes
 * qui arrivent en même temps sur une instance froide partagent alors le
 * même appel, au lieu d'en lancer deux.
 */
export function memoCourt<T>(cle: string, calculer: () => Promise<T>, delaiMs = DELAI_MS): Promise<T> {
  const maintenant = Date.now();
  const connue = memoire.get(cle) as Entree<T> | undefined;
  if (connue && connue.expire > maintenant) return connue.valeur;

  const valeur = calculer().catch((err) => {
    // Un échec ne se mémorise pas : la panne serait alors servie pendant
    // une minute à tout le monde, y compris après son rétablissement.
    memoire.delete(cle);
    throw err;
  });

  memoire.set(cle, { valeur, expire: maintenant + delaiMs });
  return valeur;
}

/** Oublie une entrée — appelé après une écriture. */
export function oublier(cle: string): void {
  memoire.delete(cle);
}

/** Oublie tout ce qui commence par ce préfixe. */
export function oublierPrefixe(prefixe: string): void {
  for (const cle of memoire.keys()) {
    if (cle.startsWith(prefixe)) memoire.delete(cle);
  }
}
