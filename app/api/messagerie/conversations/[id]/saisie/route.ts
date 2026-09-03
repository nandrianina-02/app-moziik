import { NextResponse } from "next/server";
import { Types } from "mongoose";
import Conversation from "@/models/Conversation";
import { withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";
import { conversationActive } from "@/lib/messagerieServer";

/**
 * « En train d'écrire ».
 *
 * UNE DATE, PAS UN INTERRUPTEUR
 *
 * Le client repose cette date pendant qu'il frappe, et rien ne l'éteint :
 * c'est son âge qui la périme (FENETRE_SAISIE_MS). Un booléen aurait
 * demandé un signal d'arrêt, que personne n'envoie quand l'onglet se
 * ferme, quand le réseau tombe ou quand la batterie lâche — et
 * l'indicateur serait alors allumé pour toujours.
 *
 * LA RÉPONSE EST VIDE, ET L'ÉCRITURE NE BLOQUE PAS
 *
 * Personne n'attend le résultat : la frappe continue pendant l'appel. Une
 * erreur ici ne doit surtout pas remonter à l'écran — ce serait dire à
 * quelqu'un que sa frappe a échoué.
 */
export const POST = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  const moi = await requireAuthUser(req);
  const conv = await conversationActive(params.id, moi.id);

  // Rien à signaler à soi-même : un fil avec l'assistant n'a pas d'autre
  // lecteur, et l'écriture serait pure dépense.
  if (conv.type === "assistant") return new NextResponse(null, { status: 204 });

  await Conversation.updateOne(
    { _id: conv._id },
    { $set: { "participants.$[moi].typingAt": new Date() } },
    { arrayFilters: [{ "moi.user": new Types.ObjectId(moi.id) }] }
  );

  return new NextResponse(null, { status: 204 });
});
