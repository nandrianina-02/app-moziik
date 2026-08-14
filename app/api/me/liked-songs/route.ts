import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";

export const GET = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);

  await connectDB();
  const user = await User.findById(authUser.id).populate({
    path: "likedSongs",
    match: { status: "published" },
    populate: { path: "artist", select: "stageName verified" },
  });
  if (!user) throw new ApiError("Utilisateur introuvable.", 404);

  return NextResponse.json({ songs: user.likedSongs });
});
