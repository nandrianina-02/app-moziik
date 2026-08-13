import { NextResponse } from "next/server";
import type { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Album from "@/models/Album";
import Comment from "@/models/Comment";
import { ApiError, withApiErrors } from "@/lib/apiError";

/**
 * Agrège les commentaires de tous les titres d'un album (les commentaires
 * restent rattachés à un titre en base — il n'existe pas de commentaire
 * "d'album" à proprement parler). Lecture seule : la création d'un
 * commentaire continue de se faire via /api/songs/[id]/comments sur le
 * titre concerné, sans changement de logique existante.
 */
export const GET = withApiErrors(async (_req: Request, { params }: { params: { id: string } }) => {
  await connectDB();
  const album = await Album.findById(params.id).select("songs").populate("songs", "title");
  if (!album) throw new ApiError("Album introuvable.", 404);

  // .populate() ne modifie pas le typage statique de "songs" (déclaré
  // Types.ObjectId[] dans le schéma) : cast explicite vers la forme
  // réellement renvoyée à l'exécution après population.
  const populatedSongs = album.songs as unknown as { _id: Types.ObjectId; title: string }[];

  const songIds = populatedSongs.map((s) => s._id);
  const comments = await Comment.find({ song: { $in: songIds } })
    .populate("user", "name avatarUrl")
    .sort({ createdAt: -1 })
    .limit(100);

  const songTitleById = new Map(populatedSongs.map((s) => [s._id.toString(), s.title]));
  const enriched = comments.map((c) => ({
    ...c.toObject(),
    songTitle: songTitleById.get(c.song.toString()) ?? null,
  }));

  return NextResponse.json({ comments: enriched, total: enriched.length });
});
