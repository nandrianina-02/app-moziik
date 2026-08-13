import { NextResponse } from "next/server";
import type { PipelineStage } from "mongoose";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Artist from "@/models/Artist";
import Song from "@/models/Song";
import Album from "@/models/Album";
import Playlist from "@/models/Playlist";
import Event from "@/models/Event";
import Subscription from "@/models/Subscription";
import { requireAdmin } from "@/lib/requireAdmin";
import { withApiErrors } from "@/lib/apiError";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Compte les documents créés ce mois-ci vs le mois précédent, pour une tendance réelle (pas inventée). */
async function monthlyTrend(model: { countDocuments: (q: Record<string, unknown>) => Promise<number> }, extraFilter: Record<string, unknown> = {}) {
  const now = new Date();
  const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [thisMonth, lastMonth] = await Promise.all([
    model.countDocuments({ ...extraFilter, createdAt: { $gte: startThisMonth } }),
    model.countDocuments({ ...extraFilter, createdAt: { $gte: startLastMonth, $lt: startThisMonth } }),
  ]);

  const trendPct = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : thisMonth > 0 ? 100 : null;
  return { thisMonth, lastMonth, trendPct };
}

/** Compte au jour le jour sur les N derniers jours, pour un mini-graphique en sparkline. */
async function dailyCounts(
  model: { aggregate: (pipeline: PipelineStage[]) => Promise<{ _id: string; count: number }[]> },
  days: number,
  extraMatch: Record<string, unknown> = {}
) {
  const since = new Date(Date.now() - days * DAY_MS);
  const results = await model.aggregate([
    { $match: { ...extraMatch, createdAt: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  const byDay = new Map(results.map((r) => [r._id, r.count]));

  const series: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10);
    series.push(byDay.get(day) ?? 0);
  }
  return series;
}

export const GET = withApiErrors(async () => {
  await requireAdmin();
  await connectDB();

  const [
    members,
    artists,
    publishedSongs,
    pendingSongs,
    pendingEvents,
    activeSubscriptions,
    albumsCount,
    playlistsCount,
    membersTrend,
    artistsTrend,
    songsTrend,
    subsTrend,
    membersSparkline,
    artistsSparkline,
    songsSparkline,
    signupsEvolution,
    recentMembers,
    recentArtists,
    recentSongs,
    recentEvents,
  ] = await Promise.all([
    User.countDocuments({ role: "member" }),
    Artist.countDocuments(),
    Song.countDocuments({ status: "published" }),
    Song.countDocuments({ status: "draft" }).then(async (draft) => draft + (await Song.countDocuments({ status: "scheduled" }))),
    Event.countDocuments({ status: "pending" }),
    Subscription.countDocuments({ status: "active" }),
    Album.countDocuments(),
    Playlist.countDocuments(),
    monthlyTrend(User, { role: "member" }),
    monthlyTrend(Artist),
    monthlyTrend(Song, { status: "published" }),
    monthlyTrend(Subscription, { status: "active" }),
    dailyCounts(User, 7, { role: "member" }),
    dailyCounts(Artist, 7),
    dailyCounts(Song, 7, { status: "published" }),
    dailyCounts(User, 30, { role: "member" }),
    User.find({ role: "member" }).sort({ createdAt: -1 }).limit(3).select("name createdAt"),
    Artist.find().sort({ createdAt: -1 }).limit(3).select("stageName createdAt"),
    Song.find({ status: "published" }).sort({ createdAt: -1 }).limit(3).populate("artist", "stageName").select("title createdAt artist"),
    Event.find().sort({ createdAt: -1 }).limit(3).select("title createdAt"),
  ]);

  // Reconstitue une courbe cumulative des inscriptions (nombre total de
  // membres au fil des 30 derniers jours), plus lisible qu'un décompte
  // journalier brut pour visualiser une évolution.
  const totalBeforeWindow = await User.countDocuments({
    role: "member",
    createdAt: { $lt: new Date(Date.now() - 30 * DAY_MS) },
  });
  let running = totalBeforeWindow;
  const signupsCumulative = signupsEvolution.map((count) => {
    running += count;
    return running;
  });

  type ActivityItem = { type: string; message: string; at: Date };
  const activity: ActivityItem[] = [
    ...recentMembers.map((u) => ({ type: "member", message: `${u.name} a rejoint la plateforme`, at: u.createdAt })),
    ...recentArtists.map((a) => ({
      type: "artist",
      message: `${a.stageName} a créé un profil artiste`,
      at: a.createdAt,
    })),
    ...recentSongs.map((s) => {
      const artist = s.artist as unknown as { stageName: string } | undefined;
      return { type: "song", message: `${artist?.stageName ?? "Un artiste"} a publié "${s.title}"`, at: s.createdAt };
    }),
    ...recentEvents.map((e) => ({ type: "event", message: `Nouvel évènement créé : "${e.title}"`, at: e.createdAt })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 6);

  return NextResponse.json({
    members,
    artists,
    publishedSongs,
    pendingSongs,
    pendingEvents,
    activeSubscriptions,
    albumsCount,
    playlistsCount,
    trends: {
      members: membersTrend.trendPct,
      artists: artistsTrend.trendPct,
      songs: songsTrend.trendPct,
      subscriptions: subsTrend.trendPct,
    },
    sparklines: {
      members: membersSparkline,
      artists: artistsSparkline,
      songs: songsSparkline,
    },
    signupsEvolution: signupsCumulative,
    contentBreakdown: [
      { label: "Musiques", count: publishedSongs },
      { label: "Artistes", count: artists },
      { label: "Albums", count: albumsCount },
      { label: "Playlists", count: playlistsCount },
    ],
    recentActivity: activity,
  });
});
