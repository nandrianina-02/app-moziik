import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";
import { parseOrThrow } from "@/lib/validation";
import { mesAbonnements } from "@/lib/amis";

/**
 * Le côté social du compte connecté : les membres qu'il suit, et son
 * réglage « Partager mon activité d'écoute ».
 */
export const dynamic = "force-dynamic";

export const GET = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);
  await connectDB();
  return NextResponse.json(await mesAbonnements(authUser.id), { headers: { "Cache-Control": "no-store" } });
});

const patchSchema = z.object({ partageEcoute: z.boolean() });

export const PATCH = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);
  const { partageEcoute } = parseOrThrow(patchSchema, await req.json().catch(() => ({})));
  await connectDB();
  await User.updateOne({ _id: authUser.id }, { $set: { partageEcoute } });
  return NextResponse.json({ partageEcoute });
});
