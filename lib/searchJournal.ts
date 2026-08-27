import { connectDB } from "@/lib/db";
import SearchQuery from "@/models/SearchQuery";
import { normaliser } from "@/lib/searchText";

/**
 * Journal des recherches : écriture et lecture.
 *
 * Voir models/SearchQuery.ts pour ce qui est conservé — et surtout pour
 * ce qui ne l'est pas.
 */

/** En deçà, la saisie ne désigne rien : « ok », « la », une lettre isolée. */
const LONGUEUR_MIN = 3;
/** Au-delà, ce n'est plus une recherche mais un copier-coller. */
const LONGUEUR_MAX = 60;

/** Jour UTC au format AAAA-MM-JJ, comme lib/ai/usage.ts. */
export function jourUTC(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Retient une saisie, ou rend `false` si elle n'a rien à faire dans un
 * classement.
 *
 * N'échoue jamais bruyamment : un classement hebdomadaire ne vaut pas
 * qu'une recherche renvoie une erreur à celui qui l'a lancée.
 */
export async function retenirRecherche(saisie: string): Promise<boolean> {
  const terme = normaliser(saisie).slice(0, LONGUEUR_MAX);
  if (terme.length < LONGUEUR_MIN) return false;
  // Une saisie qui n'est que ponctuation ou chiffres ne désigne aucun
  // contenu : elle encombrerait le classement sans jamais se résoudre.
  if (!/[a-z]/.test(terme)) return false;

  try {
    await connectDB();
    await SearchQuery.updateOne(
      { day: jourUTC(), term: terme },
      { $inc: { count: 1 }, $set: { label: saisie.trim().slice(0, LONGUEUR_MAX), updatedAt: new Date() } },
      { upsert: true }
    );
    return true;
  } catch (err) {
    console.error("[recherche] journalisation impossible", err);
    return false;
  }
}

export type TermeRecherche = { terme: string; libelle: string; total: number };

/**
 * Termes les plus saisis sur une période, du plus demandé au moins
 * demandé.
 *
 * `from` est inclus, `to` exclu — même convention que partout dans la
 * curation.
 */
export async function termesLesPlusCherches(
  from: Date,
  to: Date,
  limite = 60
): Promise<TermeRecherche[]> {
  await connectDB();
  const lignes = await SearchQuery.aggregate<{ _id: string; total: number; libelle: string }>([
    { $match: { day: { $gte: jourUTC(from), $lt: jourUTC(to) } } },
    { $sort: { day: -1 } },
    {
      $group: {
        _id: "$term",
        total: { $sum: "$count" },
        // `$first` après un tri décroissant sur le jour : la forme
        // affichée est la plus récemment saisie, pas la plus ancienne.
        libelle: { $first: "$label" },
      },
    },
    { $sort: { total: -1 } },
    { $limit: Math.max(1, limite) },
  ]);

  return lignes.map((l) => ({ terme: l._id, libelle: l.libelle, total: l.total }));
}

/** Nombre de recherches journalisées sur la période — un signal d'activité. */
export async function volumeRecherches(from: Date, to: Date): Promise<number> {
  await connectDB();
  const [ligne] = await SearchQuery.aggregate<{ total: number }>([
    { $match: { day: { $gte: jourUTC(from), $lt: jourUTC(to) } } },
    { $group: { _id: null, total: { $sum: "$count" } } },
  ]);
  return ligne?.total ?? 0;
}

/**
 * Efface les journaux antérieurs à `jours`.
 *
 * Ces compteurs ne servent qu'à la fenêtre courante et à la comparaison
 * avec la précédente. Les garder indéfiniment ferait grossir une
 * collection que plus personne ne lit.
 */
export async function purgerJournal(jours = 120): Promise<number> {
  await connectDB();
  const limite = jourUTC(new Date(Date.now() - jours * 24 * 60 * 60 * 1000));
  const { deletedCount } = await SearchQuery.deleteMany({ day: { $lt: limite } });
  return deletedCount ?? 0;
}
