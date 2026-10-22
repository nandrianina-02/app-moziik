import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import AppareilPush from "@/models/AppareilPush";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";

const schema = z.object({
  jeton: z.string().trim().min(20).max(4096),
  plateforme: z.enum(["android"]).default("android"),
});

/**
 * POST /api/me/appareils-push — ce téléphone reçoit désormais les
 * notifications de ce compte. Un jeton déjà connu change de compte : le
 * téléphone a changé de mains, l'ancien compte ne doit plus y sonner.
 */
export const POST = withApiErrors(async (req: Request) => {
  const utilisateur = await requireAuthUser(req);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new ApiError("Jeton d'appareil invalide.", 400);
  await connectDB();
  await AppareilPush.updateOne(
    { jeton: parsed.data.jeton },
    { $set: { user: utilisateur.id, plateforme: parsed.data.plateforme, vuLe: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  );
  return NextResponse.json({ ok: true });
});

/** DELETE /api/me/appareils-push — à la déconnexion : ce téléphone ne sonne plus pour ce compte. */
export const DELETE = withApiErrors(async (req: Request) => {
  const utilisateur = await requireAuthUser(req);
  const parsed = schema.pick({ jeton: true }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new ApiError("Jeton d'appareil invalide.", 400);
  await connectDB();
  await AppareilPush.deleteOne({ jeton: parsed.data.jeton, user: utilisateur.id });
  return NextResponse.json({ ok: true });
});
