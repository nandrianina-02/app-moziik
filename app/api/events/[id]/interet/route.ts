import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Event from "@/models/Event";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";

/**
 * « Ça m'intéresse » : bascule la présence du membre dans la liste des
 * intéressés de l'évènement.
 *
 * C'est ce qui alimente le compteur de participants de la fiche. Rien
 * n'est estimé ni extrapolé : le nombre affiché est exactement le nombre
 * de membres qui ont appuyé sur ce bouton.
 */
export const POST = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  const authUser = await requireAuthUser(req);

  await connectDB();
  const event = await Event.findById(params.id);
  if (!event) throw new ApiError("Évènement introuvable.", 404);
  if (event.status !== "published") {
    throw new ApiError("Cet évènement n'est pas encore publié.", 403);
  }

  const dejaInteresse = event.interested.some((id) => id.toString() === authUser.id);
  if (dejaInteresse) {
    event.interested = event.interested.filter(
      (id) => id.toString() !== authUser.id
    ) as typeof event.interested;
  } else {
    event.interested.push(new Types.ObjectId(authUser.id));
  }

  // Recalculé depuis la liste, jamais incrémenté à l'aveugle : le
  // compteur ne peut donc pas dériver de son contenu réel.
  event.interestedCount = event.interested.length;
  await event.save();

  return NextResponse.json({
    interested: !dejaInteresse,
    interestedCount: event.interestedCount,
  });
});
