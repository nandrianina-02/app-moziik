import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { sendPasswordResetEmail } from "@/utils/mailer";
import { withApiErrors } from "@/lib/apiError";
import { checkRateLimitByIp } from "@/lib/rateLimit";
import { parseOrThrow, forgotPasswordSchema } from "@/lib/validation";

export const POST = withApiErrors(async (req: Request) => {
  // 5 demandes max / 15 min / IP : limite l'abus d'envoi d'emails et le
  // brute force d'énumération de comptes (même si la réponse ne fuite
  // déjà aucune information sur l'existence du compte).
  checkRateLimitByIp("forgot-password", { limit: 5, windowMs: 15 * 60 * 1000 });

  const { email } = parseOrThrow(forgotPasswordSchema, await req.json());

  await connectDB();
  const user = await User.findOne({ email });

  // Réponse identique que le compte existe ou non, pour ne pas
  // révéler quels emails sont enregistrés.
  if (user) {
    const token = randomUUID();
    user.resetToken = token;
    user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const resetUrl = `${process.env.NEXTAUTH_URL}/reinitialiser-mot-de-passe?token=${token}`;
    await sendPasswordResetEmail(user.email, resetUrl);
  }

  return NextResponse.json({
    message: "Si un compte existe avec cet email, un lien a été envoyé.",
  });
});
