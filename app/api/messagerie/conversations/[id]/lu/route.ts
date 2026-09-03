import { NextResponse } from "next/server";
import { Types } from "mongoose";
import Conversation from "@/models/Conversation";
import { withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";
import { conversationOuvree, toucherPresence } from "@/lib/messagerieServer";

/**
 * Marque une conversation comme lue.
 *
 * Appelée à l'ouverture du fil, et à chaque fois qu'un message arrive
 * pendant qu'il est à l'écran : lire n'est pas un état qu'on prend une
 * fois, c'est ce qui se passe tant qu'on regarde.
 *
 * Le compteur est remis à zéro plutôt que décrémenté. Décrémenter
 * supposerait de savoir combien de messages ont été vus, ce que le
 * serveur ignore et ce que le client n'a aucune raison de calculer juste.
 */
export const POST = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  const moi = await requireAuthUser(req);
  const conv = await conversationOuvree(params.id, moi.id);
  toucherPresence(moi.id);

  await Conversation.updateOne(
    { _id: conv._id },
    { $set: { "participants.$[moi].unread": 0, "participants.$[moi].lastReadAt": new Date() } },
    { arrayFilters: [{ "moi.user": new Types.ObjectId(moi.id) }] }
  );

  return NextResponse.json({ nonLus: 0 });
});
