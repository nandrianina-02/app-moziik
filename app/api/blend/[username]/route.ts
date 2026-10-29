import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";
import { BlendRefuse, blendEntre } from "@/lib/blend";

/** Le Blend du compte connecté avec un membre qu'il suit et qui le suit. */
export const dynamic = "force-dynamic";

export const GET = withApiErrors(async (req: Request, { params }: { params: { username: string } }) => {
  const authUser = await requireAuthUser(req);
  await connectDB();
  try {
    const blend = await blendEntre(authUser.id, params.username);
    if (!blend) throw new ApiError("Profil introuvable.", 404);
    return NextResponse.json(blend, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof BlendRefuse) throw new ApiError(e.message, 403);
    throw e;
  }
});
