import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Album from "@/models/Album";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const GET = withApiErrors(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new ApiError("Non authentifié.", 401);

  await connectDB();
  const user = await User.findById(session.user.id).populate({
    path: "savedAlbums",
    populate: { path: "artist", select: "stageName verified" },
  });
  if (!user) throw new ApiError("Utilisateur introuvable.", 404);

  return NextResponse.json({ albums: user.savedAlbums });
});

export const POST = withApiErrors(async (req: Request) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new ApiError("Non authentifié.", 401);

  const { albumId } = await req.json();
  if (!albumId) throw new ApiError("Album manquant.");

  await connectDB();
  const [user, album] = await Promise.all([User.findById(session.user.id), Album.findById(albumId)]);
  if (!user) throw new ApiError("Utilisateur introuvable.", 404);
  if (!album) throw new ApiError("Album introuvable.", 404);

  const alreadySaved = user.savedAlbums.some((id) => id.toString() === albumId);

  if (alreadySaved) {
    user.savedAlbums = user.savedAlbums.filter((id) => id.toString() !== albumId) as typeof user.savedAlbums;
  } else {
    user.savedAlbums.push(new Types.ObjectId(albumId));
  }

  await user.save();
  return NextResponse.json({ saved: !alreadySaved });
});
