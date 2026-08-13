import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { checkRateLimitByIp } from "@/lib/rateLimit";
import { parseOrThrow, resetPasswordSchema } from "@/lib/validation";

export const POST = withApiErrors(async (req: Request) => {
  // Limite le brute force du token de reset (qui est un UUID, donc déjà
  // difficile à deviner, mais une limite reste une bonne pratique de
  // défense en profondeur).
  checkRateLimitByIp("reset-password", { limit: 10, windowMs: 15 * 60 * 1000 });

  const { token, password } = parseOrThrow(resetPasswordSchema, await req.json());

  await connectDB();
  const user = await User.findOne({
    resetToken: token,
    resetTokenExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new ApiError("Lien invalide ou expiré.", 400);
  }

  user.passwordHash = await bcrypt.hash(password, 12);
  user.resetToken = undefined;
  user.resetTokenExpires = undefined;
  await user.save();

  return NextResponse.json({ message: "Mot de passe mis à jour." });
});
