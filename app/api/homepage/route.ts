import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Subscription from "@/models/Subscription";
import { hasPremiumAccess } from "@/lib/premium";
import { withApiErrors } from "@/lib/apiError";
import { getHomepageData } from "@/lib/homeContentEngine";
import { recordHomepageView } from "@/lib/homepageStats";
import { getAuthUser } from "@/lib/mobileAuth";

export const GET = withApiErrors(async (req: Request) => {
  const authUser = await getAuthUser(req);
  const data = await getHomepageData(authUser?.id);

  recordHomepageView().catch(() => {});

  if (authUser) {
    const premiumSection = data.sections.find((s) => s.key === "premium");
    if (premiumSection) {
      await connectDB();
      const subscription = await Subscription.findOne({ user: authUser.id }).sort({ startedAt: -1 });
      (premiumSection.data as { isSubscriber?: boolean }).isSubscriber = hasPremiumAccess({
        role: authUser.role,
        subscriptionStatus: subscription?.status,
      });
    }
  }

  return NextResponse.json(data);
});
