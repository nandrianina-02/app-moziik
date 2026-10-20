import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { checkRateLimitByIp } from "@/lib/rateLimit";
import { utilisateurDuCode } from "@/lib/authRelay";
import { issueRefreshToken, signAccessToken } from "@/lib/mobileAuth";
import { mobileRelaisSchema, parseOrThrow } from "@/lib/validation";

// Dernière étape du relais Google (voir ../route.ts) pour l'app native.
//
// La coquille Capacitor échange son code contre un cookie de session
// (../consommer) ; l'app native n'a pas de cookies : elle reçoit ici les
// mêmes jetons que la connexion par e-mail (/api/mobile-auth/login), sous la
// même forme. Le code, à usage unique et valable une minute, ne s'obtient
// qu'après une vraie connexion Google dans le navigateur.

export const dynamic = "force-dynamic";

export const POST = withApiErrors(async (req: Request) => {
  checkRateLimitByIp("auth-relais-jetons", { limit: 20, windowMs: 15 * 60 * 1000 });
  const { code, device } = parseOrThrow(mobileRelaisSchema, await req.json());

  const user = await utilisateurDuCode(code);
  const accessToken = signAccessToken({ sub: user._id.toString(), role: user.role });
  const refreshToken = await issueRefreshToken(user._id.toString(), device);

  return NextResponse.json({
    accessToken,
    refreshToken,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
    },
  });
});
