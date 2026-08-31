import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Album from "@/models/Album";
import Artist from "@/models/Artist";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, createAlbumSchema } from "@/lib/validation";
import { requireAuthUser } from "@/lib/mobileAuth";

export const GET = withApiErrors(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const artistId = searchParams.get("artist");

  await connectDB();
  const query = artistId ? { artist: artistId } : {};
  const albums = await Album.find(query).populate("artist", "stageName verified").sort({ releaseDate: -1 });

  return NextResponse.json({ albums });
});

export const POST = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);
  if (authUser.role !== "artist" && authUser.role !== "admin") {
    throw new ApiError("Seuls les artistes peuvent créer un album.", 403);
  }

  const { title, coverUrl, type, releaseDate } = parseOrThrow(createAlbumSchema, await req.json());

  await connectDB();
  const artistProfile = await Artist.findOne({ user: authUser.id });
  if (!artistProfile) throw new ApiError("Profil artiste introuvable.", 404);

  const album = await Album.create({
    title,
    coverUrl,
    type: type ?? "album",
    releaseDate,
    artist: artistProfile._id,
    // Un album appartient entièrement à son auteur : il suit son univers,
    // sans exception (lib/universClassify.ts).
    univers: artistProfile.univers,
  });

  return NextResponse.json({ album }, { status: 201 });
});
