import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import Artist from "@/models/Artist";
import { ApiError, withApiErrors } from "@/lib/apiError";

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
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new ApiError("Non authentifié.", 401);

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

    const ownerArtist = await Artist.findOne({ user: session.user.id });
    const isOwner = ownerArtist && song.artist.equals(ownerArtist._id);
    if (!isOwner && session.user.role !== "admin") {
      throw new ApiError("Tu ne peux modifier que tes propres sons.", 403);
    }

    const updates = await req.json();
    const allowed = [
      "title",
      "coverUrl",
      "audioUrl",
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
        if (key === "status" && session.user.role !== "admin") continue;
        (song as unknown as Record<string, unknown>)[key] = updates[key];
      }
    }

    // Album : "" / null signifie "single" (aucun album), qu'on ne peut pas
    // exprimer avec la boucle générique ci-dessus (elle ignorerait une
    // valeur falsy en la traitant comme absente).
    if ("albumId" in updates) {
      song.album = updates.albumId || undefined;
    }

    // Featuring : on réconcilie avec les crédits existants pour ne pas
    // perdre les confirmations déjà données par les artistes en featuring.
    if (Array.isArray(updates.featuringIds)) {
      const previouslyConfirmed = new Map(
        song.featuring.map((f) => [String(f.artist), f.confirmed])
      );
      song.featuring = updates.featuringIds
        .filter((id: string) => id !== song.artist.toString())
        .map((id: string) => ({
          artist: id,
          confirmed: previouslyConfirmed.get(id) ?? false,
        })) as typeof song.featuring;
    }

    // Réattribution de l'artiste principal : réservée à l'admin, comme à
    // la publication (cf. POST /api/songs). On vérifie que l'id fourni
    // est un ObjectId valide avant assignation : un cast Mongoose raté
    // ici plantait auparavant en 500 sans message exploitable.
    if (session.user.role === "admin" && typeof updates.artistId === "string" && updates.artistId) {
      if (!mongoose.Types.ObjectId.isValid(updates.artistId)) {
        throw new ApiError("Identifiant d'artiste invalide.");
      }
      song.artist = updates.artistId as unknown as typeof song.artist;
    }

    if (updates.releaseDate) {
      song.status = new Date(updates.releaseDate) <= new Date() ? "published" : "scheduled";
    }

    try {
      await song.save();
    } catch (err) {
      // Une erreur de validation/cast Mongoose est un vrai problème de
      // saisie (ex: champ trop long, type incompatible) — elle doit
      // remonter avec son message réel, pas comme un 500 générique
      // impossible à diagnostiquer depuis le navigateur.
      if (err instanceof mongoose.Error.ValidationError || err instanceof mongoose.Error.CastError) {
        throw new ApiError(`Données invalides : ${err.message}`, 400);
      }
      throw err;
    }

    await song.populate("artist", "stageName verified coverUrl");
    await song.populate("featuring.artist", "stageName verified");
    await song.populate("album", "title coverUrl type");
    return NextResponse.json({ song });
  }
);

export const DELETE = withApiErrors(
  async (_req: Request, { params }: { params: { id: string } }) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new ApiError("Non authentifié.", 401);

    await connectDB();
    const song = await Song.findById(params.id);
    if (!song) throw new ApiError("Son introuvable.", 404);

    if (!song.artist) {
      if (session.user.role !== "admin") throw new ApiError("Ce son n'a pas d'artiste associé.", 403);
    } else {
      const ownerArtist = await Artist.findOne({ user: session.user.id });
      const isOwner = ownerArtist && song.artist.equals(ownerArtist._id);
      if (!isOwner && session.user.role !== "admin") {
        throw new ApiError("Tu ne peux supprimer que tes propres sons.", 403);
      }
    }

    await song.deleteOne();
    return NextResponse.json({ message: "Son supprimé." });
  }
);
