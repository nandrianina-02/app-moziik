import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Subscription from "@/models/Subscription";
import { hasPremiumAccess } from "@/lib/premium";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const GET = withApiErrors(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new ApiError("Non authentifié.", 401);

  await connectDB();
  const subscription = await Subscription.findOne({ user: session.user.id }).sort({ startedAt: -1 });

  const hasPremium = hasPremiumAccess({
    role: session.user.role,
    subscriptionStatus: subscription?.status,
  });

  return NextResponse.json({ subscription, hasPremium, isAdmin: session.user.role === "admin" });
});
