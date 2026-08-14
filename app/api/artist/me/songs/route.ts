import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import Artist from "@/models/Artist";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";

export const GET = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);

  await connectDB();
  const artist = await Artist.findOne({ user: authUser.id });
  if (!artist) throw new ApiError("Profil artiste introuvable.", 404);

  const songs = await Song.find({ artist: artist._id })
    .populate("artist", "stageName verified")
    .populate("featuring.artist", "stageName verified")
    .sort({ createdAt: -1 });

  return NextResponse.json({ songs });
});
