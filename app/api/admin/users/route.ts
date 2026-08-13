import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Artist from "@/models/Artist";
import { requireAdmin } from "@/lib/requireAdmin";
import { withApiErrors } from "@/lib/apiError";

export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin();

  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role");
  const search = searchParams.get("search");

  await connectDB();
  const query: Record<string, unknown> = {};
  if (role) query.role = role;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const users = await User.find(query).select("-passwordHash -resetToken").sort({ createdAt: -1 });

  const artistUserIds = users.filter((u) => u.role === "artist").map((u) => u._id);
  const artists = await Artist.find({ user: { $in: artistUserIds } }).select("user eventPublishingAuthorized");
  const artistByUserId = new Map(artists.map((a) => [a.user.toString(), a]));

  const enriched = users.map((u) => {
    const artist = artistByUserId.get(u._id.toString());
    return {
      ...u.toObject(),
      artistId: artist?._id ?? null,
      eventPublishingAuthorized: artist?.eventPublishingAuthorized ?? false,
    };
  });

  return NextResponse.json({ users: enriched });
});
