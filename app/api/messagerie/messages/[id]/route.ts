import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Message from "@/models/Message";
import Conversation from "@/models/Conversation";
import { withApiErrors, ApiError } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";
import { parseOrThrow, editionMessageSchema } from "@/lib/validation";
import {
  conversationActive,
  fichesUtilisateurs,
  presenterMessage,
} from "@/lib/messagerieServer";
import { apercuMessage } from "@/lib/messagerie";

/**
 * Corriger ou supprimer un de ses propres messages.
 *
 * ON NE MODIFIE QUE CE QU'ON A ÉCRIT
 *
 * Même un gestionnaire de groupe ne peut pas réécrire le message d'un
 * autre : une messagerie où l'administrateur peut changer les mots de
 * quelqu'un n'est plus une messagerie. Il peut exclure, pas récrire.
 *
 * LA SUPPRESSION LAISSE LA LIGNE
 *
 * Le corps est vidé, la carte de partage retirée, le document reste et
 * porte `deletedAt`. Retirer la ligne décalerait la pagination des autres
 * lecteurs en pleine lecture et ferait disparaître sans explication les
 * réponses qui citaient ce message.
 */

async function monMessage(id: string, moi: string) {
  if (!Types.ObjectId.isValid(id)) throw new ApiError("Message introuvable.", 404);
  await connectDB();
  const message = await Message.findById(id);
  if (!message) throw new ApiError("Message introuvable.", 404);
  // L'accès à la conversation est vérifié avant la propriété : sinon la
  // réponse dirait à un inconnu qu'un message existe à cet identifiant.
  const conv = await conversationActive(String(message.conversation), moi);
  if (String(message.author) !== String(moi)) {
    throw new ApiError("Vous ne pouvez modifier que vos propres messages.", 403);
  }
  return { message, conv };
}

/** Remet l'aperçu du fil à jour si c'est le dernier message qui a bougé. */
async function rafraichirApercu(conversationId: Types.ObjectId) {
  const dernier = await Message.findOne({ conversation: conversationId })
    .sort({ createdAt: -1 })
    .lean();
  await Conversation.updateOne(
    { _id: conversationId },
    {
      $set: {
        lastMessagePreview: dernier
          ? dernier.deletedAt
            ? "Message supprimé"
            : apercuMessage(dernier.body, dernier.partage)
          : "",
      },
    }
  );
}

export const PATCH = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  const moi = await requireAuthUser(req);
  const donnees = parseOrThrow(editionMessageSchema, await req.json());
  const { message, conv } = await monMessage(params.id, moi.id);

  if (message.deletedAt) throw new ApiError("Ce message a été supprimé.", 400);

  message.body = donnees.corps;
  message.editedAt = new Date();
  message.touchedAt = new Date();
  await message.save();
  await rafraichirApercu(conv._id);

  const fiches = await fichesUtilisateurs([message.author]);
  return NextResponse.json({ message: presenterMessage(message as never, fiches) });
});

export const DELETE = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  const moi = await requireAuthUser(req);
  const { message, conv } = await monMessage(params.id, moi.id);

  if (!message.deletedAt) {
    message.body = "";
    message.partage = undefined;
    message.reactions = [];
    message.deletedAt = new Date();
    message.touchedAt = new Date();
    await message.save();
    await rafraichirApercu(conv._id);
  }

  const fiches = await fichesUtilisateurs([message.author]);
  return NextResponse.json({ message: presenterMessage(message as never, fiches) });
});
