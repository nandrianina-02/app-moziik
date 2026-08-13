import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Event from "@/models/Event";
import { requireAdmin } from "@/lib/requireAdmin";
import { withApiErrors } from "@/lib/apiError";

export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  await connectDB();
  const query = status ? { status } : {};
  const events = await Event.find(query).populate("artist", "stageName").sort({ createdAt: -1 });

  return NextResponse.json({ events });
});
