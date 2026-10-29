import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";
import { suivreMembre } from "@/lib/amis";
import { prevenirNouvelAbonne } from "@/lib/notificationsSociales";

/**
 * Suivre un membre (POST) ou cesser de le suivre (DELETE).
 *
 * Les deux renvoient le nombre d'abonnés à jour, pour que le bouton
 * n'ait pas à relire tout le profil.
 */
async function basculer(req: Request, username: string, suivre: boolean) {
  const authUser = await requireAuthUser(req);
  await connectDB();
  const cible = await User.findOne({ username: username.toLowerCase(), suspended: { $ne: true } })
    .select("_id")
    .lean();
  if (!cible) throw new ApiError("Profil introuvable.", 404);
  if (String(cible._id) === authUser.id) throw new ApiError("Vous ne pouvez pas vous suivre vous-même.", 400);
  const { abonnes, nouveau } = await suivreMembre(authUser.id, String(cible._id), suivre);
  if (nouveau) await prevenirNouvelAbonne(authUser.id, String(cible._id));
  return NextResponse.json({ suivi: suivre, abonnes });
}

export const POST = withApiErrors(async (req: Request, { params }: { params: { username: string } }) =>
  basculer(req, params.username, true)
);

export const DELETE = withApiErrors(async (req: Request, { params }: { params: { username: string } }) =>
  basculer(req, params.username, false)
);
