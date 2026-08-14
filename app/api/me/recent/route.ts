import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Play from "@/models/Play";
import Song from "@/models/Song";
import { withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";

export const GET = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);

  await connectDB();

  const grouped = await Play.aggregate([
    { $match: { user: new Types.ObjectId(authUser.id) } },
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
