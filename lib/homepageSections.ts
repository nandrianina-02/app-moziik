import { connectDB } from "@/lib/db";
import HomepageSectionModel, { HomepageSectionType, SectionPage } from "@/models/HomepageSection";

type DefaultSection = {
  key: HomepageSectionType;
  title: string;
  position: number;
  limit: number;
  /**
   * Les pages autres que l'accueil arrivent **désactivées**. Activer
   * d'office des blocs sur six pages existantes en changerait l'apparence
   * sans que personne ne l'ait demandé : c'est une décision éditoriale,
   * elle revient à l'admin. La capacité est là, l'affichage attend son
   * feu vert.
   */
  enabled: boolean;
};

const HOME_SECTIONS: DefaultSection[] = [
  { key: "hero", title: "Bannière", position: 0, limit: 1, enabled: true },
  { key: "for_you", title: "Pour vous", position: 1, limit: 4, enabled: true },
  { key: "recently_played", title: "Écoutes récemment", position: 2, limit: 10, enabled: true },
  { key: "new_releases", title: "Nouveautés", position: 3, limit: 6, enabled: true },
  { key: "top_tracks", title: "Top des titres", position: 4, limit: 6, enabled: true },
  { key: "genres", title: "Ambiances pour toi", position: 5, limit: 6, enabled: true },
  { key: "playlists", title: "Playlists populaires", position: 6, limit: 6, enabled: true },
  { key: "albums", title: "Albums populaires", position: 7, limit: 6, enabled: true },
  { key: "recommendations", title: "Recommandé pour toi", position: 8, limit: 8, enabled: true },
  { key: "trending_artists", title: "Artistes en vedette", position: 9, limit: 5, enabled: true },
  { key: "events", title: "Évènements", position: 10, limit: 1, enabled: true },
  { key: "radio", title: "Radio Moziik", position: 11, limit: 1, enabled: true },
  { key: "activity", title: "Activité récente", position: 12, limit: 6, enabled: true },
  { key: "premium", title: "Passe à Premium", position: 13, limit: 1, enabled: true },
];

export const DEFAULT_SECTIONS_BY_PAGE: Record<SectionPage, DefaultSection[]> = {
  home: HOME_SECTIONS,
  discover: [
    { key: "genres", title: "Ambiances à explorer", position: 0, limit: 8, enabled: false },
    { key: "top_tracks", title: "Les plus écoutés", position: 1, limit: 6, enabled: false },
    { key: "trending_artists", title: "Artistes à suivre", position: 2, limit: 6, enabled: false },
    { key: "new_releases", title: "Nouveautés", position: 3, limit: 6, enabled: false },
  ],
  radio: [
    { key: "genres", title: "Genres populaires", position: 0, limit: 10, enabled: false },
    { key: "top_tracks", title: "Les plus écoutés", position: 1, limit: 6, enabled: false },
    { key: "trending_artists", title: "Artistes recommandés", position: 2, limit: 6, enabled: false },
    { key: "playlists", title: "Playlists à lancer", position: 3, limit: 6, enabled: false },
  ],
  library: [
    { key: "playlists", title: "Playlists à découvrir", position: 0, limit: 6, enabled: false },
    { key: "albums", title: "Albums à ajouter", position: 1, limit: 6, enabled: false },
    { key: "events", title: "Évènements à venir", position: 2, limit: 3, enabled: false },
  ],
  detail: [
    { key: "recommendations", title: "Vous aimerez aussi", position: 0, limit: 6, enabled: false },
    { key: "new_releases", title: "Sorties récentes", position: 1, limit: 6, enabled: false },
  ],
};

/** Rétro-compatibilité : les anciens appelants n'ont qu'un jeu de sections, celui de l'accueil. */
export const DEFAULT_HOMEPAGE_SECTIONS = HOME_SECTIONS;

/**
 * Identifiant global d'une section. Sur l'accueil il reste égal à la clé
 * (les sections déjà en base ne changent donc pas d'identité, et le
 * contenu épinglé qui les vise reste rattaché) ; ailleurs il est préfixé
 * par la page. L'unicité restant globale, l'index unique existant sur
 * `slug` n'a pas besoin d'être reconstruit en production.
 */
export function sectionSlug(page: SectionPage, base: string) {
  return page === "home" ? base : `${page}:${base}`;
}

/** Convertit un titre en identifiant URL-safe, utilisé comme slug pour les sections personnalisées. */
export function slugify(title: string) {
  return (
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "section"
  );
}

function toDocument(page: SectionPage, s: DefaultSection) {
  return {
    key: s.key,
    page,
    slug: sectionSlug(page, s.key),
    title: s.title,
    position: s.position,
    limit: s.limit,
    enabled: s.enabled,
    mode: "auto" as const,
    algorithm: "default",
    filters: { publicOnly: true, verifiedOnly: false, premiumOnly: false },
  };
}

// Les documents créés avant l'ouverture aux autres pages n'ont pas de
// champ `page`. Un défaut Mongoose ne s'applique qu'à la création : sans
// ce rattrapage, `find({ page: "home" })` ne les verrait pas et l'accueil
// se réinitialiserait avec les valeurs d'usine, effaçant la configuration
// de l'admin. Une fois par processus suffit.
let legacyPageBackfilled = false;

async function backfillLegacyPage() {
  if (legacyPageBackfilled) return;
  await HomepageSectionModel.updateMany({ page: { $exists: false } }, { $set: { page: "home" } });
  legacyPageBackfilled = true;
}

let legacyKeyIndexChecked = false;

/**
 * Supprime l'index unique hérité `key_1`.
 *
 * Cet index n'est déclaré dans aucun schéma : c'est un reliquat d'une
 * version antérieure du modèle. Il impose l'unicité de `key` sur toute la
 * collection, ce qui contredit deux fonctionnalités :
 *
 *  - « Ajouter une section » ne peut créer qu'UNE seule section
 *    personnalisée — la deuxième échoue en E11000, donc en 500 ;
 *  - une même clé (« genres », « top_tracks »...) ne peut pas exister à la
 *    fois sur l'accueil et sur une autre page.
 *
 * La réparation se fait ici plutôt que dans un script de migration parce
 * que la base de production n'est accessible que depuis l'application. Le
 * script scripts/fix-homepage-section-indexes.mjs fait la même chose pour
 * qui préfère l'exécuter à la main.
 */
async function dropLegacyKeyIndex() {
  if (legacyKeyIndexChecked) return;
  legacyKeyIndexChecked = true;
  try {
    const indexes = await HomepageSectionModel.collection.indexes();
    if (!indexes.some((i) => i.name === "key_1" && i.unique)) return;
    await HomepageSectionModel.collection.dropIndex("key_1");
    console.warn('[sections] index unique hérité "key_1" supprimé : il interdisait plusieurs sections de même type.');
  } catch (err) {
    // Échec non bloquant : l'insertion ci-dessous ignore déjà les
    // doublons, la page s'affichera simplement sans les sections
    // refusées plutôt que de renvoyer une erreur.
    console.error("[sections] suppression de l'index hérité impossible", err);
  }
}

/**
 * Insère les sections manquantes sans jamais faire échouer la page.
 *
 * `ordered: false` laisse passer les documents valides même si un autre
 * est refusé, et une collision de clé est ignorée : deux instances
 * serverless peuvent initialiser la même page au même instant, la
 * deuxième doit simplement ne rien faire.
 */
async function insertMissing(docs: ReturnType<typeof toDocument>[]) {
  if (docs.length === 0) return;
  try {
    await HomepageSectionModel.insertMany(docs, { ordered: false });
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code !== 11000) throw err;
    console.warn("[sections] certaines sections par défaut existaient déjà et n'ont pas été recréées.");
  }
}

/** Lit la config des sections d'une page ; l'initialise avec les valeurs par défaut au premier appel. */
export async function getHomepageSections(page: SectionPage = "home") {
  await connectDB();
  await Promise.all([backfillLegacyPage(), dropLegacyKeyIndex()]);

  const defaults = DEFAULT_SECTIONS_BY_PAGE[page] ?? [];
  const existing = await HomepageSectionModel.find({ page }).select("key slug");

  if (existing.length === 0) {
    await insertMissing(defaults.map((s) => toDocument(page, s)));
  } else {
    // Auto-réparation : un déploiement déjà initialisé avant l'ajout d'une
    // nouvelle section par défaut ne l'a pas encore en base — on ajoute
    // uniquement celles qui manquent, sans toucher aux sections existantes
    // (titres et ordre déjà personnalisés par l'admin restent intacts).
    const existingKeys = new Set(existing.map((s) => s.key));
    await insertMissing(defaults.filter((s) => !existingKeys.has(s.key)).map((s) => toDocument(page, s)));

    // Auto-réparation : les sections créées avant l'ajout du champ slug
    // (déploiements existants) n'en ont pas encore.
    const missingSlug = existing.filter((s) => !s.slug && s.key !== "custom");
    await Promise.all(
      missingSlug.map((s) => HomepageSectionModel.updateOne({ _id: s._id }, { slug: sectionSlug(page, s.key) }))
    );
  }

  return HomepageSectionModel.find({ page }).sort({ position: 1 });
}
