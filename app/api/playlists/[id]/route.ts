import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Playlist from "@/models/Playlist";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const GET = withApiErrors(async (_req: Request, { params }: { params: { id: string } }) => {
  await connectDB();
  const playlist = await Playlist.findById(params.id).populate("songs").populate("owner", "name avatarUrl");
  if (!playlist) throw new ApiError("Playlist introuvable.", 404);
  return NextResponse.json({ playlist });
});

export const PATCH = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new ApiError("Non authentifié.", 401);

    await connectDB();
    const playlist = await Playlist.findById(params.id);
    if (!playlist) throw new ApiError("Playlist introuvable.", 404);
    if (playlist.owner.toString() !== session.user.id && session.user.role !== "admin") {
      throw new ApiError("Tu ne peux modifier que tes propres playlists.", 403);
    }

    const updates = await req.json();
    const allowed = ["title", "description", "coverUrl", "isPublic"];
    for (const key of allowed) {
      if (key in updates) {
        (playlist as unknown as Record<string, unknown>)[key] = updates[key];
      }
    }
    await playlist.save();
    return NextResponse.json({ playlist });
  }
);

export const DELETE = withApiErrors(
  async (_req: Request, { params }: { params: { id: string } }) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new ApiError("Non authentifié.", 401);

    await connectDB();
    const playlist = await Playlist.findById(params.id);
    if (!playlist) throw new ApiError("Playlist introuvable.", 404);
    if (playlist.owner.toString() !== session.user.id && session.user.role !== "admin") {
      throw new ApiError("Tu ne peux supprimer que tes propres playlists.", 403);
    }

    await playlist.deleteOne();
    return NextResponse.json({ message: "Playlist supprimée." });
  }
);
