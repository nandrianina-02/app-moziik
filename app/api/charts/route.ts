import { NextResponse } from "next/server";
import type { PipelineStage } from "mongoose";
import { connectDB } from "@/lib/db";
import Play from "@/models/Play";
import Artist from "@/models/Artist";
import Song from "@/models/Song";
import { withApiErrors } from "@/lib/apiError";
import { getAuthUser } from "@/lib/mobileAuth";

type Period = "day" | "week" | "month" | "year" | "all";
type ChartType = "songs" | "artists" | "albums" | "listeners";

function periodStart(period: Period): Date | null {
  const now = new Date();
  switch (period) {
    case "day":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "week":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "month":
      return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    case "year":
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    case "all":
      return null;
  }
}

/** Durée équivalente à la période, pour construire la fenêtre "juste avant" (calcul de l'évolution). */
function previousWindow(period: Period, since: Date | null): { start: Date | null; end: Date | null } {
  if (!since) return { start: null, end: null };
  const spanMs = Date.now() - since.getTime();
  return { start: new Date(since.getTime() - spanMs), end: since };
}

async function buildRanking(type: ChartType, since: Date | null, until: Date | null, genre: string | null) {
  const match: Record<string, unknown> = { completed: true };
  if (since || until) {
    match.playedAt = {};
    if (since) (match.playedAt as Record<string, unknown>).$gte = since;
    if (until) (match.playedAt as Record<string, unknown>).$lt = until;
  }

  if (type === "songs" || type === "albums") {
    const genreMatch = genre ? [{ $match: { "song.genre": genre } }] : [];
    const pipeline: PipelineStage[] = [
      { $match: match },
      { $lookup: { from: "songs", localField: "song", foreignField: "_id", as: "song" } },
      { $unwind: "$song" },
      ...genreMatch,
    ];

    if (type === "songs") {
      pipeline.push(
        { $group: { _id: "$song._id", plays: { $sum: 1 } } },
        { $sort: { plays: -1 } },
        { $lookup: { from: "songs", localField: "_id", foreignField: "_id", as: "song" } },
        { $unwind: "$song" },
        { $lookup: { from: "artists", localField: "song.artist", foreignField: "_id", as: "artist" } },
        { $unwind: { path: "$artist", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            plays: 1,
            title: "$song.title",
            coverUrl: "$song.coverUrl",
            genre: "$song.genre",
            artistName: "$artist.stageName",
            verified: "$artist.verified",
            audioUrl: "$song.audioUrl",
            duration: "$song.duration",
            artistId: "$artist._id",
          },
        }
      );
    } else {
      pipeline.push(
        { $match: { "song.album": { $ne: null } } },
        { $group: { _id: "$song.album", plays: { $sum: 1 } } },
        { $sort: { plays: -1 } },
        { $lookup: { from: "albums", localField: "_id", foreignField: "_id", as: "album" } },
        { $unwind: "$album" },
        { $lookup: { from: "artists", localField: "album.artist", foreignField: "_id", as: "artist" } },
        { $unwind: { path: "$artist", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            plays: 1,
            title: "$album.title",
            coverUrl: "$album.coverUrl",
            artistName: "$artist.stageName",
            verified: "$artist.verified",
          },
        }
      );
    }
    return Play.aggregate(pipeline);
  }

  if (type === "artists") {
    return Play.aggregate([
      { $match: match },
      { $lookup: { from: "songs", localField: "song", foreignField: "_id", as: "song" } },
      { $unwind: "$song" },
      { $group: { _id: "$song.artist", plays: { $sum: 1 } } },
      { $sort: { plays: -1 } },
      { $lookup: { from: "artists", localField: "_id", foreignField: "_id", as: "artist" } },
      { $unwind: "$artist" },
      { $project: { plays: 1, stageName: "$artist.stageName", coverUrl: "$artist.coverUrl", verified: "$artist.verified" } },
    ]);
  }

  // listeners
  return Play.aggregate([
    { $match: { ...match, user: { $ne: null } } },
    { $group: { _id: "$user", plays: { $sum: 1 } } },
    { $sort: { plays: -1 } },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
    { $unwind: "$user" },
    { $project: { plays: 1, name: "$user.name", avatarUrl: "$user.avatarUrl" } },
  ]);
}

export const GET = withApiErrors(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") ?? "week") as Period;
  const type = (searchParams.get("type") ?? "songs") as ChartType;
  const genre = searchParams.get("genre");

  await connectDB();
  const since = periodStart(period);
  const { start: prevStart, end: prevEnd } = previousWindow(period, since);

  const [fullRanking, previousRanking, totalPlaysAgg, previousPlaysAgg, genres] = await Promise.all([
    buildRanking(type, since, null, genre),
    since ? buildRanking(type, prevStart, prevEnd, genre) : Promise.resolve([]),
    Play.countDocuments({ completed: true, ...(since ? { playedAt: { $gte: since } } : {}) }),
    prevStart ? Play.countDocuments({ completed: true, playedAt: { $gte: prevStart, $lt: prevEnd! } }) : Promise.resolve(0),
    Song.distinct("genre", { status: "published" }),
  ]);

  const previousRankById = new Map(previousRanking.map((item, i) => [String(item._id), i + 1]));
  const ranking = fullRanking.slice(0, 20).map((item, i) => {
    const rank = i + 1;
    const prevRank = previousRankById.get(String(item._id));
    const evolution = prevRank === undefined ? null : prevRank - rank; // positif = progression
    return { ...item, rank, evolution };
  });

  // Rang du visiteur connecté dans le classement complet (pas seulement le top 20).
  let viewer: { rank: number; plays: number; evolution: number | null; toNextMilestone: number } | null = null;
  const authUser = await getAuthUser(req);
  if (authUser) {
    let viewerId: string | null = null;
    if (type === "listeners") {
      viewerId = authUser.id;
    } else if (type === "songs" || type === "albums" || type === "artists") {
      const artist = await Artist.findOne({ user: authUser.id }).select("_id");
      if (artist) {
        if (type === "artists") {
          viewerId = artist._id.toString();
        } else {
          // meilleure entrée (titre ou album) de cet artiste dans le classement complet
          const mine = fullRanking
            .map((item, i) => ({ item, rank: i + 1 }))
            .filter(({ item }) => item.artistName === artist.stageName);
          if (mine.length > 0) {
            const best = mine[0];
            const prevRank = previousRankById.get(String(best.item._id));
            const milestoneEntry = fullRanking[99]; // 100e position, si elle existe
            const toNextMilestone =
              best.rank <= 100 || !milestoneEntry ? 0 : Math.max(0, milestoneEntry.plays - best.item.plays + 1);
            viewer = {
              rank: best.rank,
              plays: best.item.plays,
              evolution: prevRank === undefined ? null : prevRank - best.rank,
              toNextMilestone,
            };
          }
        }
      }
    }

    if (!viewer && viewerId) {
      const index = fullRanking.findIndex((item) => String(item._id) === viewerId);
      if (index !== -1) {
        const rank = index + 1;
        const prevRank = previousRankById.get(viewerId);
        viewer = {
          rank,
          plays: fullRanking[index].plays,
          evolution: prevRank === undefined ? null : prevRank - rank,
          toNextMilestone: 0,
        };
      }
    }
  }

  const trendPct = previousPlaysAgg > 0 ? ((totalPlaysAgg - previousPlaysAgg) / previousPlaysAgg) * 100 : null;

  return NextResponse.json({
    period,
    type,
    ranking,
    viewer,
    totalPlays: totalPlaysAgg,
    trendPct,
    genres: genres.filter(Boolean).sort(),
  });
});
