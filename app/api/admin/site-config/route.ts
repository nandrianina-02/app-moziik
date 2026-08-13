import { NextResponse } from "next/server";
import { getSiteConfig } from "@/lib/siteConfig";
import { requireAdmin } from "@/lib/requireAdmin";
import { withApiErrors } from "@/lib/apiError";

export const GET = withApiErrors(async () => {
  await requireAdmin();
  const config = await getSiteConfig();
  return NextResponse.json({ config });
});

export const PATCH = withApiErrors(async (req: Request) => {
  await requireAdmin();

  const updates = await req.json();
  const allowed = [
    "siteName",
    "tagline",
    "logoUrl",
    "supportEmail",
    "copyrightText",
    "plans",
    "genres",
    "payPerListenRateUSD",
    "defaultTheme",
    "legalEntityName",
    "legalCapital",
    "legalRcsCity",
    "legalRcsNumber",
    "legalAddress",
    "legalWebsite",
    "legalUpdatedAt",
  ];

  const config = await getSiteConfig();
  for (const key of allowed) {
    if (key in updates) {
      (config as unknown as Record<string, unknown>)[key] = updates[key];
    }
  }
  config.updatedAt = new Date();
  await config.save();

  return NextResponse.json({ config });
});
