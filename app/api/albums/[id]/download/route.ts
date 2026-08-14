import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Album from "@/models/Album";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { checkRateLimitByIp } from "@/lib/rateLimit";

/**
 * Compte un téléchargement complet de l'album (bouton "Télécharger tout").
 * Pas d'authentification requise, sur le même modèle que le compteur de
 * partage des titres — un téléchargement hors-ligne reste valable venant
 * d'un auditeur anonyme. Rate limité par IP pour éviter le gonflage
 * artificiel du compteur par un script.
 */
export const POST = withApiErrors(async (_req: Request, { params }: { params: { id: string } }) => {
  checkRateLimitByIp("album-download", { limit: 20, windowMs: 60 * 1000 });
  await connectDB();
  const album = await Album.findByIdAndUpdate(
    params.id,
    { $inc: { downloadsCount: 1 } },
    { new: true }
  ).select("downloadsCount");
  if (!album) throw new ApiError("Album introuvable.", 404);
  return NextResponse.json({ downloadsCount: album.downloadsCount });
});
