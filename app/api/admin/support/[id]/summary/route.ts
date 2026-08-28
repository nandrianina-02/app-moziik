import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SupportThread from "@/models/SupportThread";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAdmin } from "@/lib/requireAdmin";
import { resumerLeFil } from "@/lib/ai/threadSummary";

/**
 * Résumé d'un fil de support.
 *
 * POST, et non GET, pour la même raison que la réponse suggérée : l'appel
 * coûte de l'argent et compte contre le plafond journalier. Un GET serait
 * déclenché par une simple ouverture de fil, et rejoué à chaque
 * rafraîchissement de la boîte de réception.
 *
 * Rien n'est enregistré. Un résumé vieillit dès le message suivant ;
 * le stocker ferait lire à l'équipe l'état d'avant-hier en croyant lire
 * celui d'aujourd'hui.
 */
export const POST = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  const { user } = await requireAdmin(req);

  await connectDB();
  const fil = await SupportThread.findById(params.id);
  if (!fil) throw new ApiError("Fil introuvable.", 404);

  const resume = await resumerLeFil(params.id, user.id);

  // Un fil sans message n'a rien à résumer : on le dit plutôt que de
  // renvoyer trois champs vides que l'écran afficherait comme un résultat.
  if (resume.messages === 0) {
    throw new ApiError("Ce fil ne contient aucun message.", 409);
  }

  return NextResponse.json(resume);
});
