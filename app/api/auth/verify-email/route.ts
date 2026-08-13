import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { checkRateLimitByIp } from "@/lib/rateLimit";
import { parseOrThrow, verifyEmailSchema } from "@/lib/validation";

export const POST = withApiErrors(async (req: Request) => {
  // 10 essais / 15 min / IP : un token est à usage unique et suffisamment
  // long pour ne pas être deviné, mais on freine quand même les scripts.
  checkRateLimitByIp("verify-email", { limit: 10, windowMs: 15 * 60 * 1000 });

  const { token } = parseOrThrow(verifyEmailSchema, await req.json());

  await connectDB();
  const user = await User.findOne({ verificationToken: token });

  if (!user) {
    throw new ApiError("Ce lien de vérification est invalide ou a déjà été utilisé.", 400);
  }
  if (user.emailVerified) {
    return NextResponse.json({ message: "Adresse déjà confirmée. Tu peux te connecter." });
  }
  if (!user.verificationTokenExpires || user.verificationTokenExpires.getTime() < Date.now()) {
    throw new ApiError("Ce lien de vérification a expiré. Demande-en un nouveau depuis la page de connexion.", 400);
  }

  user.emailVerified = true;
  user.verificationToken = undefined;
  user.verificationTokenExpires = undefined;
  await user.save();

  return NextResponse.json({ message: "Adresse email confirmée. Tu peux maintenant te connecter." });
});
