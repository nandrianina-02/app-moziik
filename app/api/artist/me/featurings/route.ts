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

  const songs = await Song.find({ "featuring.artist": artist._id })
    .populate("artist", "stageName verified")
    .sort({ createdAt: -1 });

  const withConfirmation = songs.map((song) => {
    const credit = song.featuring.find((f) => f.artist.equals(artist._id));
    return {
      _id: song._id,
      title: song.title,
      coverUrl: song.coverUrl,
      status: song.status,
      artist: song.artist,
      confirmed: credit?.confirmed ?? false,
    };
  });

  return NextResponse.json({ songs: withConfirmation });
});
