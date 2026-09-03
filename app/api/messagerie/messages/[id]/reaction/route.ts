import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Message from "@/models/Message";
import { withApiErrors, ApiError } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";
import { parseOrThrow, reactionSchema } from "@/lib/validation";
import { conversationActive, fichesUtilisateurs, presenterMessage } from "@/lib/messagerieServer";

/**
 * Pose ou retire une réaction.
 *
 * L'appel est une bascule et non un ajout : le même emoji envoyé deux
 * fois le retire. C'est ce que fait le doigt sur l'écran — on retape sur
 * le cœur pour l'enlever — et une route « ajouter » doublée d'une route
 * « retirer » obligerait le client à savoir avant de cliquer, donc à se
 * tromper dès que deux appareils sont ouverts.
 *
 * Une personne peut poser plusieurs emojis différents sur le même
 * message ; c'est le couple (personne, emoji) qui est unique.
 */
export const POST = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  const moi = await requireAuthUser(req);
  const { emoji } = parseOrThrow(reactionSchema, await req.json());

  if (!Types.ObjectId.isValid(params.id)) throw new ApiError("Message introuvable.", 404);
  await connectDB();

  const message = await Message.findById(params.id);
  if (!message) throw new ApiError("Message introuvable.", 404);
  await conversationActive(String(message.conversation), moi.id);

  if (message.deletedAt) throw new ApiError("Ce message a été supprimé.", 400);

  const deja = message.reactions.findIndex(
    (r) => String(r.user) === String(moi.id) && r.emoji === emoji
  );
  if (deja >= 0) message.reactions.splice(deja, 1);
  else message.reactions.push({ user: new Types.ObjectId(moi.id), emoji });

  // Sans cela, la réaction resterait invisible chez les autres jusqu'à ce
  // qu'ils rechargent : le rafraîchissement ne demande que ce qui a bougé.
  message.touchedAt = new Date();
  await message.save();

  const fiches = await fichesUtilisateurs([message.author]);
  return NextResponse.json({ message: presenterMessage(message as never, fiches) });
});
