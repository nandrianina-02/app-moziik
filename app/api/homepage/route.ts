import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Subscription from "@/models/Subscription";
import { hasPremiumAccess } from "@/lib/premium";
import { withApiErrors } from "@/lib/apiError";
import { getHomepageData } from "@/lib/homeContentEngine";
import { recordHomepageView } from "@/lib/homepageStats";

export const GET = withApiErrors(async () => {
  const session = await getServerSession(authOptions);
  const data = await getHomepageData(session?.user?.id);

  recordHomepageView().catch(() => {});

  if (session?.user) {
    const premiumSection = data.sections.find((s) => s.key === "premium");
    if (premiumSection) {
      await connectDB();
      const subscription = await Subscription.findOne({ user: session.user.id }).sort({ startedAt: -1 });
      (premiumSection.data as { isSubscriber?: boolean }).isSubscriber = hasPremiumAccess({
        role: session.user.role,
        subscriptionStatus: subscription?.status,
      });
    }
  }

  return NextResponse.json(data);
});
