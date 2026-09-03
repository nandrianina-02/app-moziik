import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Conversation, { cleDirecte } from "@/models/Conversation";
import User from "@/models/User";
import { withApiErrors, ApiError } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";
import { parseOrThrow, nouvelleConversationSchema } from "@/lib/validation";
import {
  fichesUtilisateurs,
  presenterConversation,
  toucherPresence,
} from "@/lib/messagerieServer";
import { MEMBRES_MAX } from "@/lib/messagerie";

/**
 * Mes conversations, et la création d'une nouvelle.
 *
 * La liste est la page que la messagerie interroge en boucle : elle doit
 * rester bon marché. Une seule requête pour les fils, une seule pour les
 * comptes qui y figurent — pas une par conversation, sans quoi ouvrir la
 * messagerie coûterait trente allers-retours à qui a trente fils.
 */

const PAGE = 50;

export const GET = withApiErrors(async (req: Request) => {
  const moi = await requireAuthUser(req);
  await connectDB();
  toucherPresence(moi.id);

  const fils = await Conversation.find({
    participants: { $elemMatch: { user: moi.id, leftAt: { $exists: false } } },
  })
    .sort({ lastMessageAt: -1 })
    .limit(PAGE)
    .lean();

  const fiches = await fichesUtilisateurs(
    fils.flatMap((c) => c.participants.map((p) => p.user))
  );

  const conversations = fils.map((c) =>
    presenterConversation(c as never, moi.id, fiches)
  );

  return NextResponse.json({
    conversations,
    // Le total sert la pastille de la navigation, qui n'a pas besoin de
    // la liste elle-même.
    nonLus: conversations.reduce((somme, c) => somme + c.nonLus, 0),
  });
});

export const POST = withApiErrors(async (req: Request) => {
  const moi = await requireAuthUser(req);
  const donnees = parseOrThrow(nouvelleConversationSchema, await req.json());
  await connectDB();

  if (donnees.type === "direct") {
    const autre = donnees.destinataire!;
    if (autre === moi.id) throw new ApiError("Vous ne pouvez pas vous écrire à vous-même.", 400);
    if (!(await User.exists({ _id: autre }))) throw new ApiError("Ce compte n'existe pas.", 404);

    const cle = cleDirecte(moi.id, autre);

    // Chercher puis créer laisserait passer un doublon quand deux
    // appareils ouvrent le même fil en même temps. L'écriture est donc
    // faite en une opération, et c'est l'index unique sur `directKey` qui
    // arbitre : `upsert` renvoie le document existant s'il y en a un.
    const conv = await Conversation.findOneAndUpdate(
      { directKey: cle },
      {
        $setOnInsert: {
          type: "direct",
          directKey: cle,
          createdBy: new Types.ObjectId(moi.id),
          lastMessageAt: new Date(),
          lastMessagePreview: "",
          participants: [
            { user: new Types.ObjectId(moi.id), manager: true },
            { user: new Types.ObjectId(autre), manager: true },
          ],
        },
      },
      { upsert: true, new: true }
    );

    const fiches = await fichesUtilisateurs(conv!.participants.map((p) => p.user));
    return NextResponse.json({ conversation: presenterConversation(conv as never, moi.id, fiches) }, { status: 201 });
  }

  // --- Groupe
  const membres = [...new Set((donnees.membres ?? []).filter((id) => id !== moi.id))];
  if (membres.length === 0) throw new ApiError("Choisissez au moins une personne.", 400);
  if (membres.length + 1 > MEMBRES_MAX) {
    throw new ApiError(`Un groupe ne peut pas dépasser ${MEMBRES_MAX} personnes.`, 400);
  }

  const existants = await User.countDocuments({ _id: { $in: membres } });
  if (existants !== membres.length) throw new ApiError("Un des comptes choisis n'existe pas.", 404);

  const conv = await Conversation.create({
    type: "group",
    title: donnees.titre!.trim(),
    createdBy: new Types.ObjectId(moi.id),
    lastMessageAt: new Date(),
    lastMessagePreview: "",
    participants: [
      { user: new Types.ObjectId(moi.id), manager: true },
      ...membres.map((id) => ({ user: new Types.ObjectId(id), manager: false })),
    ],
  });

  const fiches = await fichesUtilisateurs(conv.participants.map((p) => p.user));
  return NextResponse.json(
    { conversation: presenterConversation(conv as never, moi.id, fiches) },
    { status: 201 }
  );
});
