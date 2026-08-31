import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Play from "@/models/Play";
import Song from "@/models/Song";
import Artist from "@/models/Artist";
import { withApiErrors } from "@/lib/apiError";
import { universDeLaRequete } from "@/lib/universServer";
import type { Univers } from "@/lib/univers";

const DAY_MS = 24 * 60 * 60 * 1000;

async function topSongs(since: Date, limit: number, withEvolution: boolean, univers: Univers) {
  const ranking = await Play.aggregate([
    { $match: { playedAt: { $gte: since }, completed: true, univers } },
    { $group: { _id: "$song", plays: { $sum: 1 } } },
    { $sort: { plays: -1 } },
    { $limit: limit },
    { $lookup: { from: "songs", localField: "_id", foreignField: "_id", as: "song" } },
    { $unwind: "$song" },
    { $lookup: { from: "artists", localField: "song.artist", foreignField: "_id", as: "artist" } },
    { $unwind: { path: "$artist", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        plays: 1,
        title: "$song.title",
        coverUrl: "$song.coverUrl",
        artistName: "$artist.stageName",
        verified: "$artist.verified",
      },
    },
  ]);

  if (!withEvolution) return ranking.map((r, i) => ({ ...r, rank: i + 1, evolution: null }));

  const spanMs = Date.now() - since.getTime();
  const previousSince = new Date(since.getTime() - spanMs);
  const previousRanking = await Play.aggregate([
    { $match: { playedAt: { $gte: previousSince, $lt: since }, completed: true, univers } },
    { $group: { _id: "$song", plays: { $sum: 1 } } },
    { $sort: { plays: -1 } },
  ]);
  const previousRank = new Map(previousRanking.map((r, i) => [String(r._id), i + 1]));

  return ranking.map((r, i) => {
    const rank = i + 1;
    const prev = previousRank.get(String(r._id));
    return { ...r, rank, evolution: prev === undefined ? null : prev - rank };
  });
}

export const GET = withApiErrors(async (req: Request) => {
  await connectDB();
  const univers = await universDeLaRequete(req);
  const since24h = new Date(Date.now() - DAY_MS);
  const sinceWeek = new Date(Date.now() - 7 * DAY_MS);

  const [topToday, trending, genreCounts, artists] = await Promise.all([
    topSongs(since24h, 5, false, univers),
    topSongs(sinceWeek, 4, true, univers),
    Song.aggregate([
      { $match: { status: "published", univers } },
      { $group: { _id: "$genre", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8},
    ]),
    Artist.aggregate([
      { $match: { univers } },
      { $lookup: { from: "songs", localField: "_id", foreignField: "artist", as: "songs" } },
      {
        $project: {
          stageName: 1,
          coverUrl: 1,
          verified: 1,
          plays: { $sum: "$songs.playsCount" },
        },
      },
      { $sort: { plays: -1 } },
      { $limit: 6 },
    ]),
  ]);

  return NextResponse.json({
    topToday,
    trending,
    genres: genreCounts.filter((g) => g._id).map((g) => ({ genre: g._id as string, count: g.count as number })),
    recommendedArtists: artists.map((a) => ({
      _id: a._id,
      stageName: a.stageName,
      coverUrl: a.coverUrl,
      verified: a.verified,
      plays: a.plays,
    })),
  });
});
