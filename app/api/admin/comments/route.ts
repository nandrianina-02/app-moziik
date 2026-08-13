import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Comment from "@/models/Comment";
import { requireAdmin } from "@/lib/requireAdmin";
import { withApiErrors } from "@/lib/apiError";

export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin();

  const { searchParams } = new URL(req.url);
  const sentiment = searchParams.get("sentiment");
  const search = searchParams.get("search");

  await connectDB();
  const query: Record<string, unknown> = {};
  if (sentiment) query.sentiment = sentiment;
  if (search) query.text = { $regex: search, $options: "i" };

  const comments = await Comment.find(query)
    .populate("user", "name")
    .populate("song", "title coverUrl")
    .sort({ createdAt: -1 })
    .limit(100);

  return NextResponse.json({ comments });
});
