import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { getAuthUser } from "@/lib/mobileAuth";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { estUnivers } from "@/lib/univers";
import { universParDefautDuSite } from "@/lib/universServer";

/**
 * L'univers musical du compte.
 *
 * Le cookie suffit à faire fonctionner le site : c'est lui que toutes les
 * routes lisent. Cette route existe pour que le choix suive le compte
 * d'un appareil à l'autre — sans elle, se connecter sur un nouveau
 * téléphone repartirait dans l'univers par défaut du site, ce qui est
 * exactement ce qu'un auditeur du répertoire évangélique ne veut pas.
 */
export const dynamic = "force-dynamic";

export const GET = withApiErrors(async (req: Request) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json(
      { univers: await universParDefautDuSite(), source: "site" },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  await connectDB();
  const compte = await User.findById(authUser.id).select("preferences.univers").lean();
  const choisi = (compte as { preferences?: { univers?: string } } | null)?.preferences?.univers;

  return NextResponse.json(
    estUnivers(choisi)
      ? { univers: choisi, source: "compte" }
      : { univers: await universParDefautDuSite(), source: "site" },
    { headers: { "Cache-Control": "no-store" } }
  );
});

export const PUT = withApiErrors(async (req: Request) => {
  const authUser = await getAuthUser(req);
  // Un visiteur non connecté a tout de même son cookie : le choix marche
  // pour lui, il ne se transporte simplement pas d'un appareil à l'autre.
  if (!authUser) return NextResponse.json({ univers: null, source: "appareil" });

  const { univers } = (await req.json()) as { univers?: unknown };
  if (!estUnivers(univers)) throw new ApiError("Univers inconnu.");

  await connectDB();
  await User.updateOne({ _id: authUser.id }, { $set: { "preferences.univers": univers } });

  return NextResponse.json({ univers, source: "compte" });
});
