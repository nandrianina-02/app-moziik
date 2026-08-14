import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Album from "@/models/Album";
import Artist from "@/models/Artist";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, patchAlbumSchema } from "@/lib/validation";
import { requireAuthUser } from "@/lib/mobileAuth";

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
    const authUser = await requireAuthUser(req);

    await connectDB();
    const album = await Album.findById(params.id);
    if (!album) throw new ApiError("Album introuvable.", 404);
    await assertOwnerOrAdmin(album.artist.toString(), authUser.id, authUser.role);

    const updates = parseOrThrow(patchAlbumSchema, await req.json()) as Record<string, unknown>;
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
  async (req: Request, { params }: { params: { id: string } }) => {
    const authUser = await requireAuthUser(req);

    await connectDB();
    const album = await Album.findById(params.id);
    if (!album) throw new ApiError("Album introuvable.", 404);
    await assertOwnerOrAdmin(album.artist.toString(), authUser.id, authUser.role);

    await album.deleteOne();
    return NextResponse.json({ message: "Album supprimé." });
  }
);
