import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Subscription from "@/models/Subscription";
import { hasPremiumAccess } from "@/lib/premium";
import { withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";

export const GET = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);

  await connectDB();
  const subscription = await Subscription.findOne({ user: authUser.id }).sort({ startedAt: -1 });

  const hasPremium = hasPremiumAccess({
    role: authUser.role,
    subscriptionStatus: subscription?.status,
  });

  return NextResponse.json({ subscription, hasPremium, isAdmin: authUser.role === "admin" });
});
