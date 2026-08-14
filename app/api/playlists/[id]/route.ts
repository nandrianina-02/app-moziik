import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Playlist from "@/models/Playlist";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, patchPlaylistSchema } from "@/lib/validation";
import { getAuthUser, requireAuthUser } from "@/lib/mobileAuth";

export const GET = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  await connectDB();
  // L'artiste de chaque titre est peuplé : sans lui, les lignes de la
  // playlist affichaient « Artiste supprimé » pour tout le monde.
  const playlist = await Playlist.findById(params.id)
    .populate({ path: "songs", populate: { path: "artist", select: "stageName verified" } })
    .populate("owner", "name avatarUrl");
  if (!playlist) throw new ApiError("Playlist introuvable.", 404);

  // Une playlist privée n'était consultable par personne d'autre que son
  // propriétaire... en théorie : la route la renvoyait en réalité à
  // quiconque connaissait son identifiant. On répond « introuvable »
  // plutôt que 403, pour ne pas confirmer son existence.
  if (!playlist.isPublic) {
    const authUser = await getAuthUser(req);
    const proprietaire = authUser && playlist.owner?._id?.toString() === authUser.id;
    if (!proprietaire && authUser?.role !== "admin") {
      throw new ApiError("Playlist introuvable.", 404);
    }
  }

  return NextResponse.json({ playlist });
});

export const PATCH = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    const authUser = await requireAuthUser(req);

    await connectDB();
    const playlist = await Playlist.findById(params.id);
    if (!playlist) throw new ApiError("Playlist introuvable.", 404);
    if (playlist.owner.toString() !== authUser.id && authUser.role !== "admin") {
      throw new ApiError("Tu ne peux modifier que tes propres playlists.", 403);
    }

    const updates = parseOrThrow(patchPlaylistSchema, await req.json()) as Record<string, unknown>;
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
  async (req: Request, { params }: { params: { id: string } }) => {
    const authUser = await requireAuthUser(req);

    await connectDB();
    const playlist = await Playlist.findById(params.id);
    if (!playlist) throw new ApiError("Playlist introuvable.", 404);
    if (playlist.owner.toString() !== authUser.id && authUser.role !== "admin") {
      throw new ApiError("Tu ne peux supprimer que tes propres playlists.", 403);
    }

    await playlist.deleteOne();
    return NextResponse.json({ message: "Playlist supprimée." });
  }
);
