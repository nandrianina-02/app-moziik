import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import HomepageSection from "@/models/HomepageSection";
import HomepagePinned from "@/models/HomepagePinned";
import { requireAdmin } from "@/lib/requireAdmin";
import { withApiErrors } from "@/lib/apiError";
import { getHomepageViewStats, getEngagementRate } from "@/lib/homepageStats";

export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin(req);
  await connectDB();

  const now = new Date();
  const [sectionsTotal, sectionsActive, pinnedTotal, pinnedActive, viewStats, engagementRatePct] = await Promise.all([
    HomepageSection.countDocuments(),
    HomepageSection.countDocuments({ enabled: true }),
    HomepagePinned.countDocuments(),
    HomepagePinned.countDocuments({
      $and: [
        { $or: [{ startDate: { $exists: false } }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: { $exists: false } }, { endDate: { $gte: now } }] },
      ],
    }),
    getHomepageViewStats(),
    getEngagementRate(),
  ]);

  return NextResponse.json({
    sectionsTotal,
    sectionsActive,
    pinnedTotal,
    pinnedActive,
    totalViews: viewStats.totalViews,
    viewsTrendPct: viewStats.viewsTrendPct,
    engagementRatePct,
  });
});
