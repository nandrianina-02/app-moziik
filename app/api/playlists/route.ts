import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Playlist from "@/models/Playlist";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const GET = withApiErrors(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  let owner = searchParams.get("owner");
  const publicOnly = searchParams.get("public") === "true";

  if (owner === "me") {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new ApiError("Non authentifié.", 401);
    owner = session.user.id;
  }

  await connectDB();
  const query: Record<string, unknown> = {};
  if (owner) query.owner = owner;
  if (publicOnly) query.isPublic = true;

  const playlists = await Playlist.find(query).populate("owner", "name avatarUrl").sort({ createdAt: -1 });
  return NextResponse.json({ playlists });
});

export const POST = withApiErrors(async (req: Request) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new ApiError("Non authentifié.", 401);

  const { title, description, coverUrl, isPublic } = await req.json();
  if (!title) throw new ApiError("Le titre est requis.");

  await connectDB();
  const playlist = await Playlist.create({
    title,
    description,
    coverUrl,
    isPublic: !!isPublic,
    owner: session.user.id,
    songs: [],
  });

  return NextResponse.json({ playlist }, { status: 201 });
});
