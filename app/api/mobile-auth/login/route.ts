import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { checkRateLimit } from "@/lib/rateLimit";
import { parseOrThrow, mobileLoginSchema } from "@/lib/validation";
import { signAccessToken, issueRefreshToken } from "@/lib/mobileAuth";

// Équivalent mobile du provider Credentials de NextAuth (lib/auth.ts) :
// mêmes règles (email vérifié, compte non suspendu, rate limit par email),
// mais renvoie des tokens JSON plutôt que de poser un cookie de session.
export const POST = withApiErrors(async (req: Request) => {
  const { email, password, device } = parseOrThrow(mobileLoginSchema, await req.json());

  checkRateLimit(`mobile-login:${email}`, { limit: 10, windowMs: 15 * 60 * 1000 });

  await connectDB();
  const user = await User.findOne({ email });

  if (!user || !user.passwordHash) {
    throw new ApiError("Aucun compte associé à cet email.", 401);
  }
  if (user.suspended) {
    throw new ApiError("Ce compte a été suspendu.", 403);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new ApiError("Mot de passe incorrect.", 401);
  }
  if (!user.emailVerified) {
    throw new ApiError("EMAIL_NOT_VERIFIED", 403);
  }

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
