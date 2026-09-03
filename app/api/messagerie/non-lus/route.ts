import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Conversation from "@/models/Conversation";
import { withApiErrors } from "@/lib/apiError";
import { getAuthUser } from "@/lib/mobileAuth";

/**
 * Combien de messages m'attendent.
 *
 * Une route à part, et minuscule, parce que c'est la seule chose dont la
 * navigation a besoin : elle est interrogée depuis toutes les pages du
 * site, y compris par qui n'ouvrira jamais la messagerie. Lui faire
 * charger la liste complète des conversations pour n'en tirer qu'un
 * nombre reviendrait à payer la messagerie sur chaque page.
 *
 * Une agrégation plutôt qu'une lecture : le total se calcule dans la
 * base, et rien ne remonte que le nombre.
 */
export const GET = withApiErrors(async (req: Request) => {
  const moi = await getAuthUser(req);
  // Pas de 401 : la navigation interroge cette route pour tout le monde,
  // et un visiteur non connecté a simplement zéro message.
  if (!moi) return NextResponse.json({ nonLus: 0, conversations: 0 });

  await connectDB();
  const [ligne] = await Conversation.aggregate<{ total: number; fils: number }>([
    { $match: { participants: { $elemMatch: { user: new Types.ObjectId(moi.id), leftAt: { $exists: false } } } } },
    { $unwind: "$participants" },
    { $match: { "participants.user": new Types.ObjectId(moi.id), "participants.unread": { $gt: 0 } } },
    { $group: { _id: null, total: { $sum: "$participants.unread" }, fils: { $sum: 1 } } },
  ]);

  return NextResponse.json({ nonLus: ligne?.total ?? 0, conversations: ligne?.fils ?? 0 });
});
