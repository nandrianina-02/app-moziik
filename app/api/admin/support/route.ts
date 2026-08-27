import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SupportThread from "@/models/SupportThread";
import { requireAdmin } from "@/lib/requireAdmin";
import { withApiErrors } from "@/lib/apiError";

/**
 * Boîte de réception du support.
 *
 * L'ordre est celui de l'attente réelle : d'abord les fils où le membre a
 * écrit en dernier et attend une réponse, puis les autres, du plus récent
 * au plus ancien. Trier seulement par date remonterait en tête un fil déjà
 * traité juste parce que l'équipe vient d'y répondre.
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
    .sort({ unreadForAdmin: -1, lastMessageAt: -1 })
    .limit(200)
    .populate("user", "name email avatarUrl role");

  const enAttente = await SupportThread.countDocuments({ status: "open", unreadForAdmin: { $gt: 0 } });

  return NextResponse.json({ threads, enAttente }, { headers: { "Cache-Control": "no-store" } });
});
