import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SupportThread from "@/models/SupportThread";
import { requireAdmin } from "@/lib/requireAdmin";
import { withApiErrors } from "@/lib/apiError";

/**
 * Boîte de réception du support.
 *
 * L'ordre est celui de l'attente réelle : d'abord les fils où quelqu'un a
 * réclamé une personne, puis ceux où le membre a écrit en dernier et
 * attend une réponse, puis les autres, du plus récent au plus ancien.
 * Trier seulement par date remonterait en tête un fil déjà traité juste
 * parce que l'équipe vient d'y répondre.
 *
 * `humanRequested` passe devant `unreadForAdmin` parce que ces fils-là
 * sont ceux où l'assistant s'est retiré : soit on le lui a demandé, soit
 * il a reconnu ne pas savoir. Dans les deux cas plus rien n'avance sans
 * l'équipe, alors qu'un fil simplement non lu a pu recevoir sa réponse.
 */
export const dynamic = "force-dynamic";

export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin(req);

  const { searchParams } = new URL(req.url);
  const statut = searchParams.get("status");

  await connectDB();

  const query: Record<string, unknown> = {};
  if (statut === "open" || statut === "closed") query.status = statut;

  const threads = await SupportThread.find(query)
    .sort({ humanRequested: -1, unreadForAdmin: -1, lastMessageAt: -1 })
    .limit(200)
    .populate("user", "name email avatarUrl role");

  const enAttente = await SupportThread.countDocuments({ status: "open", unreadForAdmin: { $gt: 0 } });
  const humainDemande = await SupportThread.countDocuments({ status: "open", humanRequested: true });

  return NextResponse.json({ threads, enAttente, humainDemande }, { headers: { "Cache-Control": "no-store" } });
});
