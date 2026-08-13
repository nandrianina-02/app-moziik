import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { sendVerificationEmail } from "@/utils/mailer";
import { withApiErrors } from "@/lib/apiError";
import { checkRateLimitByIp } from "@/lib/rateLimit";
import { parseOrThrow, resendVerificationSchema } from "@/lib/validation";

export const POST = withApiErrors(async (req: Request) => {
  // 5 renvois max / 15 min / IP : limite l'abus d'envoi d'emails, comme
  // pour /api/auth/forgot-password.
  checkRateLimitByIp("resend-verification", { limit: 5, windowMs: 15 * 60 * 1000 });

  const { email } = parseOrThrow(resendVerificationSchema, await req.json());

  await connectDB();
  const user = await User.findOne({ email });

  // Réponse identique que le compte existe, soit déjà vérifié, ou non —
  // pour ne pas révéler quels emails sont enregistrés (même pattern que
  // /api/auth/forgot-password).
  if (user && !user.emailVerified) {
    const token = randomUUID();
    user.verificationToken = token;
    user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    const verifyUrl = `${process.env.NEXTAUTH_URL}/verifier-email?token=${token}`;
    await sendVerificationEmail(user.email, verifyUrl);
  }

  return NextResponse.json({
    message: "Si un compte non vérifié existe avec cet email, un nouveau lien vient d'être envoyé.",
  });
});
