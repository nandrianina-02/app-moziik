import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Artist from "@/models/Artist";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const GET = withApiErrors(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new ApiError("Non authentifié.", 401);

  await connectDB();
  const artist = await Artist.findOne({ user: session.user.id });

  return NextResponse.json({ artist });
});

export const PATCH = withApiErrors(async (req: Request) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new ApiError("Non authentifié.", 401);
  if (session.user.role !== "artist") throw new ApiError("Réservé aux artistes.", 403);

  await connectDB();
  const artist = await Artist.findOne({ user: session.user.id });
  if (!artist) throw new ApiError("Profil artiste introuvable.", 404);

  const body = await req.json();
  const { bio, coverUrl, bannerUrl, genres, socialLinks } = body ?? {};

  if (typeof bio === "string") artist.bio = bio.slice(0, 2000);
  if (typeof coverUrl === "string") artist.coverUrl = coverUrl;
  if (typeof bannerUrl === "string") artist.bannerUrl = bannerUrl;
  if (Array.isArray(genres)) artist.genres = genres.filter((g) => typeof g === "string").slice(0, 10);
  if (Array.isArray(socialLinks)) {
    artist.socialLinks = socialLinks
      .filter((l) => l && typeof l.platform === "string" && typeof l.url === "string")
      .slice(0, 8);
  }

  await artist.save();
  return NextResponse.json({ artist });
});
