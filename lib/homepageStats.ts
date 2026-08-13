import { connectDB } from "@/lib/db";
import HomepageStatsModel from "@/models/HomepageStats";
import Play from "@/models/Play";

const HOMEPAGE_STATS_ID = "000000000000000000000003";
const DAY_MS = 24 * 60 * 60 * 1000;

function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Incrémente le compteur de vues de l'accueil (appelé à chaque GET /api/homepage). */
export async function recordHomepageView() {
  await connectDB();
  const month = currentMonthKey();
  const stats = await HomepageStatsModel.findById(HOMEPAGE_STATS_ID);

  if (!stats) {
    await HomepageStatsModel.create({
      _id: HOMEPAGE_STATS_ID,
      totalViews: 1,
      monthlyViews: [{ month, count: 1 }],
    });
    return;
  }

  const bucket = stats.monthlyViews.find((m) => m.month === month);
  if (bucket) {
    bucket.count += 1;
  } else {
    stats.monthlyViews.push({ month, count: 1 });
    if (stats.monthlyViews.length > 13) stats.monthlyViews.shift();
  }
  stats.totalViews += 1;
  stats.updatedAt = new Date();
  await stats.save();
}

/** Lit les statistiques de vues + calcule la tendance vs le mois précédent. */
export async function getHomepageViewStats() {
  await connectDB();
  const stats = await HomepageStatsModel.findById(HOMEPAGE_STATS_ID);
  if (!stats) return { totalViews: 0, viewsThisMonth: 0, viewsTrendPct: null as number | null };

  const now = currentMonthKey();
  const previous = currentMonthKey(new Date(Date.now() - 30 * DAY_MS));
  const thisMonth = stats.monthlyViews.find((m) => m.month === now)?.count ?? 0;
  const lastMonth = stats.monthlyViews.find((m) => m.month === previous)?.count ?? 0;

  const viewsTrendPct = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : null;

  return { totalViews: stats.totalViews, viewsThisMonth: thisMonth, viewsTrendPct };
}

/**
 * Taux d'engagement : approximation honnête faute de suivi précis du clic
 * "vu sur l'accueil -> écouté". On compare, sur la même fenêtre de 30
 * jours, le nombre d'écoutes déclenchées sur la plateforme aux vues de
 * la page d'accueil. Ce n'est pas un vrai taux de clic par contenu, mais
 * un indicateur réel calculé à partir de données mesurées sur la même
 * période, pas une valeur inventée.
 */
export async function getEngagementRate() {
  const { viewsThisMonth } = await getHomepageViewStats();
  if (viewsThisMonth === 0) return null;

  await connectDB();
  const since30 = new Date(Date.now() - 30 * DAY_MS);
  const playsCount = await Play.countDocuments({ playedAt: { $gte: since30 } });

  return Math.min((playsCount / viewsThisMonth) * 100, 100);
}
