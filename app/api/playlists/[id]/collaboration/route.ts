import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import Playlist from "@/models/Playlist";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAuthUser, type AuthUser } from "@/lib/mobileAuth";
import { parseOrThrow } from "@/lib/validation";

/**
 * La collaboration sur une playlist.
 *
 * GET     (propriétaire) l'état, le jeton d'invitation et les collaborateurs.
 * PATCH   (propriétaire) active ou suspend la collaboration, ou renouvelle
 *         le lien — l'ancien cesse alors de fonctionner.
 * POST    (tout membre connecté) rejoint la playlist avec le jeton du lien.
 * DELETE  le propriétaire retire un collaborateur ; un collaborateur sans
 *         `userId` se retire lui-même.
 */

const sansCache = { headers: { "Cache-Control": "no-store" } };

function nouveauJeton() {
  return randomBytes(12).toString("base64url");
}

async function charger(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError("Identifiant de playlist invalide.");
  const playlist = await Playlist.findById(id).select("+jetonInvitation");
  if (!playlist) throw new ApiError("Playlist introuvable.", 404);
  // Les sélections de la curation appartiennent à l'équipe : on ne les ouvre pas aux membres.
  if (playlist.auto) throw new ApiError("Cette playlist ne peut pas devenir collaborative.", 400);
  return playlist;
}

function exigerProprietaire(playlist: { owner: { toString(): string } }, user: AuthUser) {
  if (playlist.owner.toString() !== user.id) {
    throw new ApiError("Seul le propriétaire gère la collaboration.", 403);
  }
}

async function etat(id: string) {
  const p = await Playlist.findById(id)
    .select("+jetonInvitation collaborative collaborateurs")
    .populate("collaborateurs", "name username avatarUrl")
    .lean();
  return {
    collaborative: !!p?.collaborative,
    jeton: p?.jetonInvitation ?? null,
    collaborateurs: p?.collaborateurs ?? [],
  };
}

export const GET = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  const authUser = await requireAuthUser(req);
  await connectDB();
  const playlist = await charger(params.id);
  exigerProprietaire(playlist, authUser);
  return NextResponse.json(await etat(params.id), sansCache);
});

const patchSchema = z.object({
  collaborative: z.boolean().optional(),
  renouvelerLien: z.literal(true).optional(),
});

export const PATCH = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  const authUser = await requireAuthUser(req);
  const { collaborative, renouvelerLien } = parseOrThrow(patchSchema, await req.json().catch(() => ({})));
  await connectDB();
  const playlist = await charger(params.id);
  exigerProprietaire(playlist, authUser);

  if (typeof collaborative === "boolean") playlist.collaborative = collaborative;
  if (renouvelerLien || (playlist.collaborative && !playlist.jetonInvitation)) {
    playlist.jetonInvitation = nouveauJeton();
  }
  await playlist.save();
  return NextResponse.json(await etat(params.id), sansCache);
});

const rejoindreSchema = z.object({ jeton: z.string().min(8).max(64) });

export const POST = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  const authUser = await requireAuthUser(req);
  const { jeton } = parseOrThrow(rejoindreSchema, await req.json().catch(() => ({})));
  await connectDB();
  const playlist = await charger(params.id);

  if (playlist.owner.toString() === authUser.id) return NextResponse.json({ ok: true });
  if (!playlist.collaborative || !playlist.jetonInvitation || playlist.jetonInvitation !== jeton) {
    throw new ApiError("Ce lien d'invitation n'est plus valable.", 410);
  }
  await Playlist.updateOne({ _id: playlist._id }, { $addToSet: { collaborateurs: authUser.id } });
  return NextResponse.json({ ok: true });
});

const retirerSchema = z.object({ userId: z.string().regex(/^[a-f0-9]{24}$/).optional() });

export const DELETE = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  const authUser = await requireAuthUser(req);
  const { userId } = parseOrThrow(retirerSchema, await req.json().catch(() => ({})));
  await connectDB();
  const playlist = await charger(params.id);

  const cible = userId ?? authUser.id;
  if (cible !== authUser.id) exigerProprietaire(playlist, authUser);
  await Playlist.updateOne({ _id: playlist._id }, { $pull: { collaborateurs: cible } });
  return NextResponse.json(cible === authUser.id ? { ok: true } : await etat(params.id), sansCache);
});
