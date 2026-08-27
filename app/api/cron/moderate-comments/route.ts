import { NextResponse } from "next/server";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { viderLaFile } from "@/lib/ai/moderationQueue";

/**
 * Relecture périodique des commentaires en attente.
 *
 * À appeler par un cron externe, comme /api/cron/publish-songs et
 * /api/cron/compute-royalties, avec le même en-tête d'autorisation. Une
 * fois par heure suffit : la relecture ne masque rien, elle alimente la
 * liste que l'équipe consulte, et cette liste se rattrape de toute façon
 * à l'ouverture de /admin/commentaires.
 *
 * Le nombre de lots est borné par appel : un cron manqué pendant une
 * semaine ne doit pas déclencher, au réveil, une facture d'un coup.
 */
export const dynamic = "force-dynamic";

/** Trente commentaires par passage, soit trois lots de dix. */
const LOTS = 3;

export const POST = withApiErrors(async (req: Request) => {
  if (!process.env.CRON_SECRET) {
    // Échec bruyant plutôt que silencieux : sans cette variable, la
    // comparaison ci-dessous rejetterait TOUJOURS les appels valides.
    throw new ApiError("CRON_SECRET n'est pas configuré côté serveur.", 500);
  }
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    throw new ApiError("Non autorisé.", 401);
  }

  const resultat = await viderLaFile({ compte: "cron", lots: LOTS });

  return NextResponse.json(resultat, { headers: { "Cache-Control": "no-store" } });
});
