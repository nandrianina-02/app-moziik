import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SupportThread from "@/models/SupportThread";
import { requireAdmin } from "@/lib/requireAdmin";
import { withApiErrors } from "@/lib/apiError";
import { trierLesFils } from "@/lib/ai/triage";
import { RANG_URGENCE, type Urgence } from "@/lib/support/triageLabels";

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
 *
 * L'urgence s'insère **après** ces deux critères, jamais avant. Quelqu'un
 * qui a réclamé une personne a déjà essuyé un échec ; le faire passer
 * derrière un fil classé urgent par une machine reviendrait à lui
 * préférer une estimation. Le tri automatique range ce qui reste, il ne
 * redéfinit pas les priorités déjà établies par un humain.
 *
 * POST vide la file de tri, comme /api/admin/comments vide celle de la
 * modération. Le GET n'appelle jamais le modèle : ouvrir sa boîte de
 * réception ne doit pas dépendre d'un service tiers.
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

  // Le tri par urgence se fait en mémoire, sur les deux cents fils déjà
  // chargés : exprimer « urgence d'abord, mais après humanRequested et
  // unreadForAdmin » en base demanderait un champ calculé à chaque
  // écriture, pour trier une liste bornée.
  const rang = (u?: string) => (u ? RANG_URGENCE[u as Urgence] ?? 1 : 1);
  const ordonnes = [...threads].sort((a, b) => {
    if (a.humanRequested !== b.humanRequested) return a.humanRequested ? -1 : 1;
    const attendA = a.unreadForAdmin > 0;
    const attendB = b.unreadForAdmin > 0;
    if (attendA !== attendB) return attendA ? -1 : 1;
    const ecart = rang(a.urgence) - rang(b.urgence);
    if (ecart !== 0) return ecart;
    return b.lastMessageAt.getTime() - a.lastMessageAt.getTime();
  });

  const [enAttente, humainDemande, urgents, signales] = await Promise.all([
    SupportThread.countDocuments({ status: "open", unreadForAdmin: { $gt: 0 } }),
    SupportThread.countDocuments({ status: "open", humanRequested: true }),
    SupportThread.countDocuments({ status: "open", urgence: "haute" }),
    SupportThread.countDocuments({ status: "open", signale: true }),
  ]);

  return NextResponse.json(
    { threads: ordonnes, enAttente, humainDemande, urgents, signales },
    { headers: { "Cache-Control": "no-store" } }
  );
});

/**
 * Vide la file de tri.
 *
 * Appelé à l'ouverture de la boîte de réception : les fils arrivés
 * depuis la dernière visite sont classés pendant qu'on lit les autres.
 * Sans IA disponible, rend simplement 0 — la boîte fonctionne sans tri,
 * elle est seulement moins bien rangée.
 */
export const POST = withApiErrors(async (req: Request) => {
  const { user } = await requireAdmin(req);
  const tries = await trierLesFils(user.id);
  return NextResponse.json({ tries });
});
