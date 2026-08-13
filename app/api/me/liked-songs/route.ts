import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const GET = withApiErrors(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new ApiError("Non authentifié.", 401);

  await connectDB();
  const user = await User.findById(session.user.id).populate({
    path: "likedSongs",
    match: { status: "published" },
    populate: { path: "artist", select: "stageName verified" },
  });
  if (!user) throw new ApiError("Utilisateur introuvable.", 404);

  return NextResponse.json({ songs: user.likedSongs });
});
