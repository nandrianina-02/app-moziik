import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Play from "@/models/Play";
import Song from "@/models/Song";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const GET = withApiErrors(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new ApiError("Non authentifié.", 401);

  await connectDB();

  const grouped = await Play.aggregate([
    { $match: { user: new Types.ObjectId(session.user.id) } },
    { $sort: { playedAt: -1 } },
    { $group: { _id: "$song", lastPlayedAt: { $first: "$playedAt" } } },
    { $sort: { lastPlayedAt: -1 } },
    { $limit: 12 },
  ]);

  const songIds = grouped.map((g) => g._id);
  const songs = await Song.find({ _id: { $in: songIds }, status: "published" }).populate(
    "artist",
    "stageName verified"
  );

  const order = new Map(songIds.map((id, i) => [id.toString(), i]));
  const ordered = songs.sort(
    (a, b) => (order.get(a._id.toString()) ?? 0) - (order.get(b._id.toString()) ?? 0)
  );

  return NextResponse.json({ songs: ordered });
});
