import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Comment from "@/models/Comment";
import { requireAdmin } from "@/lib/requireAdmin";
import { withApiErrors } from "@/lib/apiError";
import { escapeRegex } from "@/lib/regex";
import { viderLaFile } from "@/lib/ai/moderationQueue";

/**
 * Les commentaires, vus par l'équipe.
 *
 * Le tri place les signalés en tête quel que soit le filtre : c'est ce
 * que l'équipe vient chercher, et un signalement noyé dans cent
 * commentaires ordinaires ne sert à rien.
 */
export const dynamic = "force-dynamic";

export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin(req);

  const { searchParams } = new URL(req.url);
  const sentiment = searchParams.get("sentiment");
  const search = searchParams.get("search");
  const signales = searchParams.get("flagged") === "1";

  await connectDB();
  const query: Record<string, unknown> = {};
  if (sentiment) query.sentiment = sentiment;
  if (signales) query.flagged = true;
  // Échappée : une recherche contenant « ( » ou « * » levait jusqu'ici une
  // erreur de regex invalide, et un motif pathologique dégradait la
  // requête. Même traitement que partout ailleurs dans le projet.
  if (search) query.text = { $regex: escapeRegex(search), $options: "i" };

  const comments = await Comment.find(query)
    .populate("user", "name")
    .populate("song", "title coverUrl")
    .sort({ flagged: -1, createdAt: -1 })
    .limit(100);

  const [enAttente, totalSignales] = await Promise.all([
    Comment.countDocuments({ moderatedAt: { $exists: false } }),
    Comment.countDocuments({ flagged: true }),
  ]);

  return NextResponse.json({ comments, enAttente, totalSignales }, { headers: { "Cache-Control": "no-store" } });
});

/**
 * Relit maintenant les commentaires en attente.
 *
 * Déclenché par la page de modération à son ouverture : c'est là que le
 * retard du cron se verrait, autant le rattraper au moment où quelqu'un
 * regarde. Ne lève pas quand l'IA est indisponible — la page fonctionne
 * sans, elle affiche simplement moins.
 */
export const POST = withApiErrors(async (req: Request) => {
  const { user: admin } = await requireAdmin(req);
  const resultat = await viderLaFile({ compte: admin.id });
  return NextResponse.json(resultat, { headers: { "Cache-Control": "no-store" } });
});
