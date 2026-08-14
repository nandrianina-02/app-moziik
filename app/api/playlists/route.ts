import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Playlist from "@/models/Playlist";
import { withApiErrors } from "@/lib/apiError";
import { parseOrThrow, createPlaylistSchema } from "@/lib/validation";
import { requireAuthUser } from "@/lib/mobileAuth";

export const GET = withApiErrors(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  let owner = searchParams.get("owner");
  const publicOnly = searchParams.get("public") === "true";

  if (owner === "me") {
    const authUser = await requireAuthUser(req);
    owner = authUser.id;
  }

  await connectDB();
  const query: Record<string, unknown> = {};
  if (owner) query.owner = owner;
  if (publicOnly) query.isPublic = true;

  const playlists = await Playlist.find(query).populate("owner", "name avatarUrl").sort({ createdAt: -1 });
  return NextResponse.json({ playlists });
});

export const POST = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);

  const { title, description, coverUrl, isPublic } = parseOrThrow(createPlaylistSchema, await req.json());

  await connectDB();
  const playlist = await Playlist.create({
    title,
    description,
    coverUrl,
    isPublic,
    owner: authUser.id,
    songs: [],
  });

  return NextResponse.json({ playlist }, { status: 201 });
});
