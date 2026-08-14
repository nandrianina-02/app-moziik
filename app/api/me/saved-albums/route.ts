import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Album from "@/models/Album";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, toggleSavedAlbumSchema } from "@/lib/validation";
import { requireAuthUser } from "@/lib/mobileAuth";

export const GET = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);

  await connectDB();
  const user = await User.findById(authUser.id).populate({
    path: "savedAlbums",
    populate: { path: "artist", select: "stageName verified" },
  });
  if (!user) throw new ApiError("Utilisateur introuvable.", 404);

  return NextResponse.json({ albums: user.savedAlbums });
});

export const POST = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);

  const { albumId } = parseOrThrow(toggleSavedAlbumSchema, await req.json());

  await connectDB();
  const [user, album] = await Promise.all([User.findById(authUser.id), Album.findById(albumId)]);
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
