import { NextResponse } from "next/server";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { checkRateLimitByIp } from "@/lib/rateLimit";
import { verifierJetonGoogle } from "@/lib/jetonGoogle";
import { compteGoogle } from "@/lib/compteGoogle";
import { issueRefreshToken, signAccessToken } from "@/lib/mobileAuth";
import { mobileGoogleSchema, parseOrThrow } from "@/lib/validation";

// Connexion Google de l'app Android, sans quitter l'app : la fenêtre Google
// intégrée à Android (Credential Manager) rend un jeton d'identité signé
// par Google, vérifié ici (lib/jetonGoogle.ts). Le compte est ensuite
// traité comme une connexion Google du site (lib/compteGoogle.ts) et l'app
// reçoit les mêmes jetons que la connexion par e-mail.

export const dynamic = "force-dynamic";

export const POST = withApiErrors(async (req: Request) => {
  checkRateLimitByIp("mobile-google", { limit: 20, windowMs: 15 * 60 * 1000 });
  const { idToken, device } = parseOrThrow(mobileGoogleSchema, await req.json());

  const profil = await verifierJetonGoogle(idToken);
  const user = await compteGoogle(profil);
  if (!user) throw new ApiError("Ce compte a été suspendu.", 403);

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
