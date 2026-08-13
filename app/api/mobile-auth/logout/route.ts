import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { parseOrThrow, mobileRefreshSchema } from "@/lib/validation";
import { revokeRefreshToken } from "@/lib/mobileAuth";

// Révoque uniquement l'appareil courant (son refresh token), pas les
// autres sessions mobiles de l'utilisateur — cohérent avec un "se
// déconnecter" classique plutôt qu'un "déconnecter partout".
export const POST = withApiErrors(async (req: Request) => {
  const { refreshToken } = parseOrThrow(mobileRefreshSchema, await req.json());
  await revokeRefreshToken(refreshToken);
  return NextResponse.json({ success: true });
});
