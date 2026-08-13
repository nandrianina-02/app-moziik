import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Playlist from "@/models/Playlist";
import { requireAdmin } from "@/lib/requireAdmin";
import { withApiErrors } from "@/lib/apiError";

export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin();

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");

  await connectDB();
  const query = search ? { title: { $regex: search, $options: "i" } } : {};

  const playlists = await Playlist.find(query)
    .populate("owner", "name email")
    .sort({ createdAt: -1 })
    .limit(100);

  return NextResponse.json({ playlists });
});
