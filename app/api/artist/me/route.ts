import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Artist from "@/models/Artist";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, patchArtistMeSchema } from "@/lib/validation";
import { requireAuthUser } from "@/lib/mobileAuth";

export const GET = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);

  await connectDB();
  const artist = await Artist.findOne({ user: authUser.id });

  return NextResponse.json({ artist });
});

export const PATCH = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);
  if (authUser.role !== "artist") throw new ApiError("Réservé aux artistes.", 403);

  await connectDB();
  const artist = await Artist.findOne({ user: authUser.id });
  if (!artist) throw new ApiError("Profil artiste introuvable.", 404);

  const { bio, coverUrl, bannerUrl, genres, socialLinks } = parseOrThrow(patchArtistMeSchema, await req.json());

  if (typeof bio === "string") artist.bio = bio;
  if (typeof coverUrl === "string") artist.coverUrl = coverUrl;
  if (typeof bannerUrl === "string") artist.bannerUrl = bannerUrl;
  if (Array.isArray(genres)) artist.genres = genres;
  if (Array.isArray(socialLinks)) artist.socialLinks = socialLinks;

  await artist.save();
  return NextResponse.json({ artist });
});
