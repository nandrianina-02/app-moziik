import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import SessionEcoute from "@/models/SessionEcoute";
import Song from "@/models/Song";
import User from "@/models/User";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";
import { parseOrThrow } from "@/lib/validation";

/**
 * Une écoute à plusieurs, par son code.
 *
 * GET    l'état de la lecture de l'hôte, position recalculée à l'instant ;
 *        l'invité qui lit est noté comme participant.
 * PUT    l'hôte publie son état (titre, position, lecture ou pause).
 * DELETE l'hôte ferme la session ; un invité la quitte.
 *
 * `no-store` partout : l'état change toutes les secondes, et deux comptes
 * ne doivent pas se partager une réponse en cache.
 */

const DUREE_MS = 6 * 60 * 60 * 1000;
/** Un invité qui n'a pas relu l'état depuis 30 secondes n'est plus compté. */
const PRESENCE_MS = 30_000;
/** La présence d'un invité n'est réécrite qu'au plus toutes les 15 secondes : il relit toutes les trois. */
const PRESENCE_ECRITURE_MS = 15_000;

const etatSchema = z.object({
  titreId: z.string().regex(/^[a-f0-9]{24}$/).nullable(),
  positionMs: z.number().int().min(0).max(24 * 3600 * 1000),
  enLecture: z.boolean(),
});

const sansCache = { headers: { "Cache-Control": "no-store" } };

async function trouver(code: string) {
  const session = await SessionEcoute.findOne({ code: code.toUpperCase() });
  if (!session) throw new ApiError("Cette écoute est terminée ou le code est inconnu.", 404);
  return session;
}

export const GET = withApiErrors(async (req: Request, { params }: { params: { code: string } }) => {
  const authUser = await requireAuthUser(req);
  await connectDB();
  const session = await trouver(params.code);
  const estHote = String(session.hote) === authUser.id;
  const maintenant = Date.now();

  if (!estHote) {
    const present = session.participants.find((p) => String(p.user) === authUser.id);
    if (!present) {
      session.participants.push({ user: authUser.id as never, vuLe: new Date() });
      await session.save();
    } else if (maintenant - present.vuLe.getTime() > PRESENCE_ECRITURE_MS) {
      await SessionEcoute.updateOne(
        { _id: session._id, "participants.user": authUser.id },
        { $set: { "participants.$.vuLe": new Date() } }
      );
    }
  }

  const [titre, hote] = await Promise.all([
    session.titre
      ? Song.findOne({ _id: session.titre, status: "published" })
          .populate("artist", "stageName verified coverUrl")
          .populate("album", "title coverUrl type")
          .lean()
      : null,
    User.findById(session.hote).select("name avatarUrl").lean(),
  ]);
  const ecoule = session.enLecture ? maintenant - session.majLe.getTime() : 0;

  return NextResponse.json(
    {
      code: session.code,
      estHote,
      hote: { name: hote?.name ?? "Hôte", avatarUrl: hote?.avatarUrl },
      titre,
      positionMs: session.positionMs + ecoule,
      enLecture: session.enLecture,
      participants: session.participants.filter((p) => maintenant - p.vuLe.getTime() < PRESENCE_MS).length,
    },
    sansCache
  );
});

export const PUT = withApiErrors(async (req: Request, { params }: { params: { code: string } }) => {
  const authUser = await requireAuthUser(req);
  await connectDB();
  const session = await trouver(params.code);
  if (String(session.hote) !== authUser.id) throw new ApiError("Seul l'hôte conduit l'écoute.", 403);
  const etat = parseOrThrow(etatSchema, await req.json());
  session.titre = (etat.titreId ?? undefined) as never;
  session.positionMs = etat.positionMs;
  session.enLecture = etat.enLecture;
  session.majLe = new Date();
  session.expireLe = new Date(Date.now() + DUREE_MS);
  await session.save();
  return NextResponse.json({ ok: true }, sansCache);
});

export const DELETE = withApiErrors(async (req: Request, { params }: { params: { code: string } }) => {
  const authUser = await requireAuthUser(req);
  await connectDB();
  const session = await trouver(params.code);
  if (String(session.hote) === authUser.id) {
    await session.deleteOne();
  } else {
    await SessionEcoute.updateOne({ _id: session._id }, { $pull: { participants: { user: authUser.id } } });
  }
  return NextResponse.json({ ok: true }, sansCache);
});
