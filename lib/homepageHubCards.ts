import { connectDB } from "@/lib/db";
import HomepageHubCardModel, { IHomepageHubCard } from "@/models/HomepageHubCard";
import Song from "@/models/Song";
import Play from "@/models/Play";

export const DEFAULT_HUB_CARDS: Pick<
  IHomepageHubCard,
  "title" | "subtitle" | "badge" | "linkHref" | "autoKey" | "position"
>[] = [
  {
    title: "Daily Mix",
    subtitle: "Vos titres préférés mis à jour",
    badge: "01",
    linkHref: "#recommendations",
    autoKey: "daily_mix",
    position: 0,
  },
  {
    title: "Nouveautés",
    subtitle: "Les derniers titres ajoutés",
    linkHref: "#new_releases",
    autoKey: "new_releases",
    position: 1,
  },
  {
    title: "Top Écoutes",
    subtitle: "Les titres les plus écoutés en ce moment",
    linkHref: "#top_tracks",
    autoKey: "top_tracks",
    position: 2,
  },
  {
    title: "Chill Vibes",
    subtitle: "Détendez-vous avec ces sons apaisants",
    linkHref: "/recherche?q=chill",
    autoKey: "chill",
    position: 3,
  },
];

/** Lit les cartes en base ; les initialise avec les 4 valeurs par défaut au premier appel. */
export async function getHubCards() {
  await connectDB();
  const count = await HomepageHubCardModel.countDocuments();

  if (count === 0) {
    await HomepageHubCardModel.insertMany(
      DEFAULT_HUB_CARDS.map((c) => ({ ...c, enabled: true }))
    );
  }

  return HomepageHubCardModel.find().sort({ position: 1 });
}

/**
 * Résout la pochette d'une carte "auto" à partir du contenu réel
 * (dernier titre sorti, titre le plus écouté...) tant que l'admin n'a
 * pas défini de pochette personnalisée. Une seule requête par type de
 * carte présente, peu importe le nombre de cartes qui la partagent.
 */
async function resolveAutoCovers(autoKeys: IHomepageHubCard["autoKey"][], userId?: string) {
  const covers = new Map<string, string | undefined>();
  const need = new Set(autoKeys.filter(Boolean));

  if (need.has("new_releases")) {
    const song = await Song.findOne({ status: "published" }).sort({ releaseDate: -1 }).select("coverUrl");
    covers.set("new_releases", song?.coverUrl);
  }
  if (need.has("top_tracks")) {
    const song = await Song.findOne({ status: "published" }).sort({ playsCount: -1 }).select("coverUrl");
    covers.set("top_tracks", song?.coverUrl);
  }
  if (need.has("chill")) {
    const song = await Song.findOne({ status: "published", genre: /chill/i }).select("coverUrl");
    covers.set("chill", song?.coverUrl);
  }
  if (need.has("daily_mix")) {
    // Sans historique d'écoute (utilisateur anonyme ou nouveau), on
    // retombe sur le titre le plus populaire — cohérent avec le
    // comportement de la section "Recommandé pour toi".
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let song = null;
    if (userId) {
      const recentPlay = await Play.findOne({ user: userId, playedAt: { $gte: since } })
        .sort({ playedAt: -1 })
        .populate({ path: "song", select: "coverUrl status" });
      const playedSong = recentPlay?.song as unknown as { coverUrl?: string; status?: string } | null;
      if (playedSong && playedSong.status === "published") song = playedSong;
    }
    if (!song) {
      song = await Song.findOne({ status: "published" }).sort({ playsCount: -1 }).select("coverUrl");
    }
    covers.set("daily_mix", song?.coverUrl);
  }

  return covers;
}

export type HubCardPayload = {
  _id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  coverUrl?: string;
  linkHref: string;
};

/** Construit la liste finale des cartes "Pour vous" pour le payload de la home. */
export async function getForYouCards(limit: number, userId?: string): Promise<HubCardPayload[]> {
  const cards = (await getHubCards()).filter((c) => c.enabled).slice(0, limit);
  const autoCovers = await resolveAutoCovers(
    cards.map((c) => c.autoKey),
    userId
  );

  return cards.map((c) => ({
    _id: c._id.toString(),
    title: c.title,
    subtitle: c.subtitle,
    badge: c.badge,
    coverUrl: c.coverUrl || (c.autoKey ? autoCovers.get(c.autoKey) : undefined),
    linkHref: c.linkHref,
  }));
}
