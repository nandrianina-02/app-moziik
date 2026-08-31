import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { getAuthUser } from "@/lib/mobileAuth";
import { withApiErrors } from "@/lib/apiError";

/**
 * Les réglages régionaux du compte, et rien d'autre.
 *
 * Cette route est appelée à chaque chargement de page par
 * SiteConfigProvider : elle doit rester minuscule, et surtout ne pas
 * échouer quand personne n'est connecté — un visiteur anonyme suit
 * simplement les réglages du site.
 */
export const dynamic = "force-dynamic";

export const GET = withApiErrors(async (req: Request) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ preferences: null }, { headers: { "Cache-Control": "no-store" } });
  }

  await connectDB();
  const user = await User.findById(authUser.id).select("preferences").lean();

  return NextResponse.json(
    { preferences: user?.preferences ?? null },
    { headers: { "Cache-Control": "no-store" } }
  );
});
