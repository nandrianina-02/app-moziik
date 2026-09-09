import { unstable_cache, revalidateTag } from "next/cache";
import type { HomepageSectionType } from "@/models/HomepageSection";

/**
 * Le cache partagé des sections d'accueil.
 *
 * POURQUOI IL FAUT UN CACHE PARTAGÉ, EN PLUS DES DEUX AUTRES
 *
 * Trois choses différentes portent le même nom dans ce projet, et elles
 * ne se remplacent pas :
 *
 * - `lib/instantane.ts` garde sur l'appareil ce qu'on a vu la dernière
 *   fois. Il rend l'accueil immédiat pour qui revient, et ne fait rien
 *   pour qui arrive.
 * - `lib/memoCourt.ts` retient le préambule dans la mémoire d'une
 *   instance. Il ne survit pas à un démarrage à froid, et deux instances
 *   n'en partagent rien.
 * - Celui-ci, le cache de données de Next, est partagé entre les
 *   instances et survit aux déploiements. C'est le seul qui rende
 *   l'accueil rapide pour quelqu'un qui n'est jamais venu.
 *
 * CE QU'ON A LE DROIT D'Y METTRE
 *
 * Uniquement ce qui ne dépend pas de qui regarde. Quatre sections en
 * dépendent — « pour vous », « écoutés récemment », les recommandations
 * quand un compte est connecté, et la bannière Premium qui lit
 * l'abonnement — et elles restent calculées à chaque fois. Les y mettre
 * ferait servir les suggestions d'un inconnu, ce qui n'est pas une
 * lenteur mais une fuite.
 *
 * COMMENT LA CLÉ EST FORMÉE
 *
 * Elle porte tout ce qui change le résultat : la section, sa page, son
 * univers, le mode d'écoute, la limite, les filtres — et la date de
 * dernière modification de la section. Cette dernière est ce qui rend
 * l'invalidation gratuite du côté de l'administration : renommer une
 * section, changer sa limite ou son ordre change son `updatedAt`, donc
 * sa clé, donc son contenu est recalculé sans que personne ait à y
 * penser.
 *
 * CE QUE LA CLÉ NE PEUT PAS COUVRIR
 *
 * Le catalogue. Un titre publié à l'instant n'apparaîtra pas dans
 * « Nouveautés » tant que l'entrée n'a pas expiré — d'où le délai court
 * ci-dessous, et l'étiquette que les routes de publication effacent.
 */

/**
 * Cinq minutes.
 *
 * Assez pour que plusieurs visiteurs d'affilée profitent du même calcul,
 * assez peu pour qu'un contenu publié sans passer par les routes qui
 * effacent l'étiquette — un import en masse, un script — finisse par
 * apparaître tout seul.
 */
const DELAI_S = 300;

/** Ce qui efface d'un coup toutes les sections mises en cache. */
export const ETIQUETTE_SECTIONS = "sections-accueil";

/**
 * Les sections dont le contenu est le même pour tout le monde.
 *
 * Liste explicite, et non « tout sauf » : ajouter une section
 * personnalisée sans y penser la ferait entrer dans le cache partagé par
 * défaut, et le défaut doit être le sûr.
 */
const PARTAGEABLES = new Set<HomepageSectionType>([
  "new_releases",
  "top_tracks",
  "albums",
  "trending_artists",
  "playlists",
  "genres",
  "events",
  "radio",
  "activity",
  "custom",
]);

/**
 * Vrai quand cette section peut être servie depuis le cache partagé.
 *
 * Les recommandations en font partie **seulement** pour un visiteur non
 * connecté : sans compte, elles retombent sur un calcul générique, et
 * c'est justement le cas où le cache sert le plus.
 */
export function estPartageable(cle: HomepageSectionType, connecte: boolean): boolean {
  if (cle === "recommendations") return !connecte;
  return PARTAGEABLES.has(cle);
}

/**
 * Exécute un calcul de section à travers le cache partagé.
 *
 * Le résultat traverse une sérialisation JSON : les documents Mongoose en
 * ressortent en objets simples. C'est sans conséquence — c'est déjà la
 * forme que le navigateur reçoit — mais cela signifie qu'aucun appelant
 * ne doit compter sur une méthode de document après cet appel.
 */
export async function auCache<T>(cle: string[], calculer: () => Promise<T>): Promise<T> {
  try {
    return await unstable_cache(calculer, cle, {
      revalidate: DELAI_S,
      tags: [ETIQUETTE_SECTIONS],
    })();
  } catch (err) {
    // « Invariant: incrementalCache missing » : le cache de données n'est
    // joignable que depuis un contexte de requête. Un script, un test ou
    // une génération hors requête n'en a pas.
    //
    // Le repli n'est pas une politesse. Sans lui, l'erreur remonte à
    // `buildSection`, qui la journalise et OMET la section : la page
    // perdrait onze de ses quatorze blocs, silencieusement. Une absence
    // de cache doit coûter du temps, jamais du contenu.
    if (err instanceof Error && err.message.includes("incrementalCache")) return calculer();
    throw err;
  }
}

/**
 * Efface les sections mises en cache.
 *
 * Appelé quand une publication change ce que l'accueil doit montrer :
 * un titre mis en ligne, un évènement publié. Sans cela, la nouveauté
 * attendrait l'expiration — cinq minutes pendant lesquelles l'artiste
 * qui vient de publier ne verrait pas son morceau.
 */
export function oublierSectionsPubliees(): void {
  try {
    revalidateTag(ETIQUETTE_SECTIONS);
  } catch {
    // `revalidateTag` n'est appelable que depuis un contexte de requête.
    // Un script en ligne de commande n'en a pas : le contenu apparaîtra à
    // l'expiration, ce qui est le comportement acceptable pour un import.
  }
}
