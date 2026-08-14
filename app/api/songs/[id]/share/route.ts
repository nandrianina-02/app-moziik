import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { checkRateLimitByIp } from "@/lib/rateLimit";

/**
 * Compte un partage (bouton "Partager" du menu contextuel et du lecteur).
 * Pas d'authentification requise : un partage reste valable venant d'un
 * auditeur anonyme. Utilisé par le moteur de contenu de la page
 * d'accueil pour le score du "Top des titres" (20% du score) — rate limité
 * par IP pour empêcher un script de gonfler artificiellement ce score.
 */
export const POST = withApiErrors(async (_req: Request, { params }: { params: { id: string } }) => {
  checkRateLimitByIp("song-share", { limit: 20, windowMs: 60 * 1000 });
  await connectDB();
  const song = await Song.findByIdAndUpdate(params.id, { $inc: { sharesCount: 1 } }, { new: true }).select(
    "sharesCount"
  );
  if (!song) throw new ApiError("Son introuvable.", 404);
  return NextResponse.json({ sharesCount: song.sharesCount });
});
