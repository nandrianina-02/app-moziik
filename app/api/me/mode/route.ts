import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { getAuthUser } from "@/lib/mobileAuth";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { estMode } from "@/lib/modes";

/**
 * Le mode d'écoute retenu par le compte.
 *
 * Le cookie suffit à faire fonctionner le site : c'est lui que toutes les
 * routes lisent. Cette route existe pour que le choix suive le compte
 * d'un appareil à l'autre — quelqu'un qui écoute en mode Sommeil sur son
 * téléphone n'a pas envie de le reconfigurer sur son ordinateur.
 *
 * « auto » est stocké tel quel, et non résolu : c'est une préférence
 * durable (« laisse l'heure décider »), pas un mode. Le résoudre en base
 * figerait le mode du soir où le choix a été fait.
 */
export const dynamic = "force-dynamic";

export const GET = withApiErrors(async (req: Request) => {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ mode: null }, { headers: { "Cache-Control": "no-store" } });

  await connectDB();
  const compte = await User.findById(authUser.id).select("preferences.mode").lean();
  const choisi = (compte as { preferences?: { mode?: string } } | null)?.preferences?.mode ?? null;

  return NextResponse.json({ mode: choisi }, { headers: { "Cache-Control": "no-store" } });
});

export const PUT = withApiErrors(async (req: Request) => {
  const authUser = await getAuthUser(req);
  // Un visiteur non connecté a tout de même son cookie : le choix marche
  // pour lui, il ne se transporte simplement pas d'un appareil à l'autre.
  if (!authUser) return NextResponse.json({ mode: null, source: "appareil" });

  const { mode } = (await req.json()) as { mode?: unknown };
  if (mode !== "auto" && !estMode(mode)) throw new ApiError("Mode d'écoute inconnu.");

  await connectDB();
  await User.updateOne({ _id: authUser.id }, { $set: { "preferences.mode": mode } });

  return NextResponse.json({ mode, source: "compte" });
});
