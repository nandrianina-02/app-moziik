import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import Artist from "@/models/Artist";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const GET = withApiErrors(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new ApiError("Non authentifié.", 401);

  await connectDB();
  const artist = await Artist.findOne({ user: session.user.id });
  if (!artist) throw new ApiError("Profil artiste introuvable.", 404);

  const songs = await Song.find({ artist: artist._id })
    .populate("artist", "stageName verified")
    .populate("featuring.artist", "stageName verified")
    .sort({ createdAt: -1 });

  return NextResponse.json({ songs });
});
