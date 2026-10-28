import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import Doublon from "@/models/Doublon";
import SupportThread from "@/models/SupportThread";
import CurationRun from "@/models/CurationRun";
import { withApiErrors } from "@/lib/apiError";
import { requireAdmin } from "@/lib/requireAdmin";
import { ANNEES_DOUTEUSES, GENRES_PROPOSES } from "@/lib/adminQualite";

/**
 * Ce qui attend une décision de l'administration, page par page : la
 * navigation de l'administration l'affiche à côté de chaque entrée, et la
 * vue d'ensemble en fait sa liste de travail. Des comptes seulement, aucun
 * contenu : la route est appelée à chaque changement de page.
 */
export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin(req);
  await connectDB();

  const [messages, selections, genres, doublons, annees] = await Promise.all([
    SupportThread.countDocuments({ status: "open", unreadForAdmin: { $gt: 0 } }),
    CurationRun.countDocuments({ statut: "a_valider" }),
    Song.countDocuments(GENRES_PROPOSES),
    Doublon.countDocuments({ statut: "a-traiter" }),
    Song.countDocuments(ANNEES_DOUTEUSES),
  ]);

  return NextResponse.json(
    {
      "/admin/messages": messages,
      "/admin/selections": selections,
      "/admin/genres": genres,
      "/admin/doublons": doublons,
      "/admin/annees": annees,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
});
