import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import Artist from "@/models/Artist";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, patchSongSchema } from "@/lib/validation";
import { requireAuthUser } from "@/lib/mobileAuth";

export const GET = withApiErrors(async (_req: Request, { params }: { params: { id: string } }) => {
  await connectDB();
  const song = await Song.findById(params.id)
    .populate("artist", "stageName verified coverUrl")
    .populate("featuring.artist", "stageName verified")
    .populate("album", "title coverUrl type");
  if (!song) throw new ApiError("Son introuvable.", 404);
  return NextResponse.json({ song });
});

export const PATCH = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    const authUser = await requireAuthUser(req);

    await connectDB();
    const song = await Song.findById(params.id);
    if (!song) throw new ApiError("Son introuvable.", 404);

    // Garde-fou : song.artist devrait toujours être défini (required en
    // base), mais un document créé avant l'ajout de cette contrainte, ou
    // corrompu, plantait ici avec une erreur non gérée (500 opaque) au
    // lieu d'un message clair.
    if (!song.artist) {
      throw new ApiError("Ce son n'a pas d'artiste associé et ne peut pas être modifié en l'état.", 500);
    }

    const ownerArtist = await Artist.findOne({ user: authUser.id });
    const isOwner = ownerArtist && song.artist.equals(ownerArtist._id);
    if (!isOwner && authUser.role !== "admin") {
      throw new ApiError("Tu ne peux modifier que tes propres sons.", 403);
    }

    const parsedUpdates = parseOrThrow(patchSongSchema, await req.json());
    const updates = parsedUpdates as Record<string, unknown>;
    const allowed = [
      "title",
      "coverUrl",
      "audioUrl",
      "videoUrl",
      "videoUrl",
      "duration",
      "genre",
      "lyrics",
      "description",
      "tags",
      "language",
      "composer",
      "producer",
      "bpm",
      "musicalKey",
      "isrc",
      "copyright",
      "explicit",
      "releaseDate",
      "status",
    ];
    for (const key of allowed) {
      if (key in updates) {
        // Un admin peut forcer le statut (validation / rejet) ; un
        // artiste ne peut que replanifier sa date de sortie.
        if (key === "status" && authUser.role !== "admin") continue;
        (song as unknown as Record<string, unknown>)[key] = updates[key];
      }
    }

    // Album : "" / null signifie "single" (aucun album), qu'on ne peut pas
    // exprimer avec la boucle générique ci-dessus (elle ignorerait une
    // valeur falsy en la traitant comme absente).
    if ("albumId" in updates) {
      song.album = (parsedUpdates.albumId || undefined) as unknown as typeof song.album;
    }

    // Featuring : on réconcilie avec les crédits existants pour ne pas
    // perdre les confirmations déjà données par les artistes en featuring.
    if (Array.isArray(parsedUpdates.featuringIds)) {
      const previouslyConfirmed = new Map(
        song.featuring.map((f) => [String(f.artist), f.confirmed])
      );
      song.featuring = parsedUpdates.featuringIds
        .filter((id: string) => id !== song.artist.toString())
        .map((id: string) => ({
          artist: id,
          confirmed: previouslyConfirmed.get(id) ?? false,
        })) as unknown as typeof song.featuring;
    }

    // Réattribution de l'artiste principal : réservée à l'admin, comme à
    // la publication (cf. POST /api/songs). On vérifie que l'id fourni
    // est un ObjectId valide avant assignation : un cast Mongoose raté
    // ici plantait auparavant en 500 sans message exploitable.
    if (authUser.role === "admin" && typeof parsedUpdates.artistId === "string" && parsedUpdates.artistId) {
      if (!mongoose.Types.ObjectId.isValid(parsedUpdates.artistId)) {
        throw new ApiError("Identifiant d'artiste invalide.");
      }
      song.artist = parsedUpdates.artistId as unknown as typeof song.artist;
    }

    if (parsedUpdates.releaseDate) {
      song.status = new Date(parsedUpdates.releaseDate) <= new Date() ? "published" : "scheduled";
    }

    // Les erreurs de validation/cast Mongoose sont traduites en 400 avec
    // leur message réel par withApiErrors (voir lib/apiError.ts).
    await song.save();

    await song.populate("artist", "stageName verified coverUrl");
    await song.populate("featuring.artist", "stageName verified");
    await song.populate("album", "title coverUrl type");
    return NextResponse.json({ song });
  }
);

export const DELETE = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    const authUser = await requireAuthUser(req);

    await connectDB();
    const song = await Song.findById(params.id);
    if (!song) throw new ApiError("Son introuvable.", 404);

    if (!song.artist) {
      if (authUser.role !== "admin") throw new ApiError("Ce son n'a pas d'artiste associé.", 403);
    } else {
      const ownerArtist = await Artist.findOne({ user: authUser.id });
      const isOwner = ownerArtist && song.artist.equals(ownerArtist._id);
      if (!isOwner && authUser.role !== "admin") {
        throw new ApiError("Tu ne peux supprimer que tes propres sons.", 403);
      }
    }

    await song.deleteOne();
    return NextResponse.json({ message: "Son supprimé." });
  }
);
