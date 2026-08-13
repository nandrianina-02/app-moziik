import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { sendVerificationEmail } from "@/utils/mailer";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { checkRateLimitByIp } from "@/lib/rateLimit";
import { parseOrThrow, registerSchema } from "@/lib/validation";

export const POST = withApiErrors(async (req: Request) => {
  // 5 inscriptions max / 15 min / IP : limite le spam de comptes sans
  // gêner un utilisateur légitime qui se trompe une ou deux fois.
  checkRateLimitByIp("register", { limit: 5, windowMs: 15 * 60 * 1000 });

  const { name, email, password } = parseOrThrow(registerSchema, await req.json());

  await connectDB();

  const existing = await User.findOne({ email });
  if (existing) {
    throw new ApiError("Un compte existe déjà avec cet email.", 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const verificationToken = randomUUID();

  const user = await User.create({
    name,
    email,
    passwordHash,
    role: "member",
    emailVerified: false,
    verificationToken,
    verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  const verifyUrl = `${process.env.NEXTAUTH_URL}/verifier-email?token=${verificationToken}`;
  await sendVerificationEmail(user.email, verifyUrl);

  return NextResponse.json(
    { id: user._id, name: user.name, email: user.email, requiresEmailVerification: true },
    { status: 201 }
  );
});
