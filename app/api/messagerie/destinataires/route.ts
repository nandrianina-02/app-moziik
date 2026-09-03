import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Conversation from "@/models/Conversation";
import { withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";
import { escapeRegex } from "@/lib/regex";

/**
 * À qui écrire.
 *
 * Sans recherche, la route rend les personnes avec qui on parle déjà,
 * les plus récentes d'abord : c'est ce qu'on veut neuf fois sur dix en
 * ouvrant « Nouveau message », et cela évite de présenter l'annuaire
 * complet des membres à quelqu'un qui cherche son ami.
 *
 * Avec recherche, elle interroge les comptes par nom et par identifiant
 * public. Les comptes suspendus n'y figurent pas : leur écrire ne mènerait
 * à rien.
 */

const LIMITE = 20;

type Brut = Record<string, unknown>;

export const GET = withApiErrors(async (req: Request) => {
  const moi = await requireAuthUser(req);
  await connectDB();

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();

  if (!q) {
    const fils = await Conversation.find({
      participants: { $elemMatch: { user: moi.id, leftAt: { $exists: false } } },
    })
      .sort({ lastMessageAt: -1 })
      .limit(40)
      .select("participants")
      .lean();

    const ids = [
      ...new Set(
        fils
          .flatMap((c) => c.participants.map((p) => String(p.user)))
          .filter((id) => id !== String(moi.id))
      ),
    ].slice(0, LIMITE);

    const comptes = (await User.find({ _id: { $in: ids }, suspended: { $ne: true } })
      .select("name username avatarUrl lastSeenAt")
      .lean()) as unknown as Brut[];

    // L'ordre de `$in` n'est pas celui du tableau : on le rétablit pour
    // que « récent » veuille dire quelque chose.
    const parId = new Map(comptes.map((c) => [String(c._id), c]));
    const ordonnes = ids.map((id) => parId.get(id)).filter(Boolean) as Brut[];

    return NextResponse.json({ personnes: ordonnes.map(presenter), recents: true });
  }

  const motif = new RegExp(escapeRegex(q), "i");
  const comptes = (await User.find({
    _id: { $ne: new Types.ObjectId(moi.id) },
    suspended: { $ne: true },
    $or: [{ name: motif }, { username: motif }],
  })
    .select("name username avatarUrl lastSeenAt")
    .limit(LIMITE)
    .lean()) as unknown as Brut[];

  return NextResponse.json({ personnes: comptes.map(presenter), recents: false });
});

function presenter(c: Brut) {
  return {
    _id: String(c._id),
    name: String(c.name ?? "Membre"),
    username: typeof c.username === "string" ? c.username : undefined,
    avatarUrl: typeof c.avatarUrl === "string" ? c.avatarUrl : undefined,
    vuLe: c.lastSeenAt ? new Date(String(c.lastSeenAt)).toISOString() : null,
  };
}
