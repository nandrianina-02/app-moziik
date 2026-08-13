import { NextResponse } from "next/server";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { checkRateLimitByIp } from "@/lib/rateLimit";
import { parseOrThrow, mobileRefreshSchema } from "@/lib/validation";
import { rotateAccessToken } from "@/lib/mobileAuth";

export const POST = withApiErrors(async (req: Request) => {
  checkRateLimitByIp("mobile-refresh", { limit: 30, windowMs: 15 * 60 * 1000 });

  const { refreshToken } = parseOrThrow(mobileRefreshSchema, await req.json());

  try {
    const { accessToken } = await rotateAccessToken(refreshToken);
    return NextResponse.json({ accessToken });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError("Refresh token invalide.", 401);
  }
});
