import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Album from "@/models/Album";
import Artist from "@/models/Artist";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const GET = withApiErrors(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const artistId = searchParams.get("artist");

  await connectDB();
  const query = artistId ? { artist: artistId } : {};
  const albums = await Album.find(query).populate("artist", "stageName verified").sort({ releaseDate: -1 });

  return NextResponse.json({ albums });
});

export const POST = withApiErrors(async (req: Request) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new ApiError("Non authentifié.", 401);
  if (session.user.role !== "artist" && session.user.role !== "admin") {
    throw new ApiError("Seuls les artistes peuvent créer un album.", 403);
  }

  const { title, coverUrl, type, releaseDate } = await req.json();
  if (!title || !coverUrl || !releaseDate) throw new ApiError("Champs obligatoires manquants.");

  await connectDB();
  const artistProfile = await Artist.findOne({ user: session.user.id });
  if (!artistProfile) throw new ApiError("Profil artiste introuvable.", 404);

  const album = await Album.create({
    title,
    coverUrl,
    type: type ?? "album",
    releaseDate,
    artist: artistProfile._id,
  });

  return NextResponse.json({ album }, { status: 201 });
});
