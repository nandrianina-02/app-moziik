import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";
import { activiteDesAmis } from "@/lib/amis";

/**
 * Ce que les membres suivis écoutent, ou ont écouté en dernier. Seuls
 * apparaissent ceux qui partagent leur activité.
 */
export const dynamic = "force-dynamic";

export const GET = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);
  await connectDB();
  const activite = await activiteDesAmis(authUser.id);
  return NextResponse.json({ activite }, { headers: { "Cache-Control": "no-store" } });
});
