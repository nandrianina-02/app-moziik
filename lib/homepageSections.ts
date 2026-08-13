import { connectDB } from "@/lib/db";
import HomepageSectionModel, { HomepageSectionType } from "@/models/HomepageSection";

export const DEFAULT_HOMEPAGE_SECTIONS: {
  key: HomepageSectionType;
  title: string;
  position: number;
  limit: number;
}[] = [
  { key: "hero", title: "Bannière", position: 0, limit: 1 },
  { key: "for_you", title: "Pour vous", position: 1, limit: 4 },
  { key: "recently_played", title: "Écoutes récemment", position: 2, limit: 10 },
  { key: "new_releases", title: "Nouveautés", position: 3, limit: 6 },
  { key: "top_tracks", title: "Top des titres", position: 4, limit: 6 },
  { key: "genres", title: "Ambiances pour toi", position: 5, limit: 6 },
  { key: "playlists", title: "Playlists populaires", position: 6, limit: 6 },
  { key: "albums", title: "Albums populaires", position: 7, limit: 6 },
  { key: "recommendations", title: "Recommandé pour toi", position: 8, limit: 8 },
  { key: "trending_artists", title: "Artistes en vedette", position: 9, limit: 5 },
  { key: "events", title: "Évènements", position: 10, limit: 1 },
  { key: "radio", title: "Radio Moziik", position: 11, limit: 1 },
  { key: "activity", title: "Activité récente", position: 12, limit: 6 },
  { key: "premium", title: "Passe à Premium", position: 13, limit: 1 },
];

/** Convertit un titre en identifiant URL-safe, utilisé comme slug pour les sections personnalisées. */
export function slugify(title: string) {
  return (
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "section"
  );
}

/** Lit la config des sections en base ; l'initialise avec les valeurs par défaut au premier appel. */
export async function getHomepageSections() {
  await connectDB();
  const count = await HomepageSectionModel.countDocuments();

  if (count === 0) {
    await HomepageSectionModel.insertMany(
      DEFAULT_HOMEPAGE_SECTIONS.map((s) => ({
        key: s.key,
        slug: s.key,
        title: s.title,
        position: s.position,
        limit: s.limit,
        enabled: true,
        mode: "auto",
        algorithm: "default",
        filters: { publicOnly: true, verifiedOnly: false, premiumOnly: false },
      }))
    );
  } else {
    // Auto-réparation : un déploiement déjà initialisé avant l'ajout
    // d'une nouvelle section par défaut (ex: for_you, recently_played)
    // ne l'a pas encore en base — on ajoute uniquement celles qui
    // manquent, sans toucher aux sections existantes (titres et ordre
    // déjà personnalisés par l'admin restent intacts).
    const existingKeys = new Set((await HomepageSectionModel.find().select("key")).map((s) => s.key));
    const missingDefaults = DEFAULT_HOMEPAGE_SECTIONS.filter((s) => !existingKeys.has(s.key));
    if (missingDefaults.length > 0) {
      await HomepageSectionModel.insertMany(
        missingDefaults.map((s) => ({
          key: s.key,
          slug: s.key,
          title: s.title,
          position: s.position,
          limit: s.limit,
          enabled: true,
          mode: "auto",
          algorithm: "default",
          filters: { publicOnly: true, verifiedOnly: false, premiumOnly: false },
        }))
      );
    }

    // Auto-réparation : les sections créées avant l'ajout du champ slug
    // (déploiements existants) n'en ont pas encore. Pour les 12 types
    // fixes, le slug est toujours identique à la clé.
    const missingSlug = await HomepageSectionModel.find({ slug: { $exists: false }, key: { $ne: "custom" } });
    await Promise.all(missingSlug.map((s) => HomepageSectionModel.updateOne({ _id: s._id }, { slug: s.key })));
  }

  return HomepageSectionModel.find().sort({ position: 1 });
}
