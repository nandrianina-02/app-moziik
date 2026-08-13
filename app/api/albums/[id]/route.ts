import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Album from "@/models/Album";
import Artist from "@/models/Artist";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const GET = withApiErrors(async (_req: Request, { params }: { params: { id: string } }) => {
  await connectDB();
  const album = await Album.findById(params.id)
    .populate("artist", "stageName verified bio")
    .populate("songs");
  if (!album) throw new ApiError("Album introuvable.", 404);
  return NextResponse.json({ album });
});

async function assertOwnerOrAdmin(albumArtistId: string, userId: string, role?: string) {
  if (role === "admin") return;
  const artistProfile = await Artist.findOne({ user: userId });
  if (!artistProfile || artistProfile._id.toString() !== albumArtistId) {
    throw new ApiError("Tu ne peux modifier que tes propres albums.", 403);
  }
}

export const PATCH = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new ApiError("Non authentifié.", 401);

    await connectDB();
    const album = await Album.findById(params.id);
    if (!album) throw new ApiError("Album introuvable.", 404);
    await assertOwnerOrAdmin(album.artist.toString(), session.user.id, session.user.role);

    const updates = await req.json();
    const allowed = ["title", "coverUrl", "bannerUrl", "description", "type", "releaseDate", "songs"];
    for (const key of allowed) {
      if (key in updates) {
        (album as unknown as Record<string, unknown>)[key] = updates[key];
      }
    }
    await album.save();
    return NextResponse.json({ album });
  }
);

export const DELETE = withApiErrors(
  async (_req: Request, { params }: { params: { id: string } }) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new ApiError("Non authentifié.", 401);

    await connectDB();
    const album = await Album.findById(params.id);
    if (!album) throw new ApiError("Album introuvable.", 404);
    await assertOwnerOrAdmin(album.artist.toString(), session.user.id, session.user.role);

    await album.deleteOne();
    return NextResponse.json({ message: "Album supprimé." });
  }
);
