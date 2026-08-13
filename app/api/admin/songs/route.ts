import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import { requireAdmin } from "@/lib/requireAdmin";
import { withApiErrors } from "@/lib/apiError";

export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  await connectDB();
  const query = status ? { status } : {};
  const songs = await Song.find(query).populate("artist", "stageName verified").sort({ createdAt: -1 });

  return NextResponse.json({ songs });
});
