import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { withApiErrors } from "@/lib/apiError";
import { getHomepageSections } from "@/lib/homepageSections";
import { getHomepageSettings } from "@/lib/homepageSettings";
import { parseOrThrow, adminHomepageSettingsSchema } from "@/lib/validation";

export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin(req);
  const [sections, settings] = await Promise.all([getHomepageSections(), getHomepageSettings()]);
  return NextResponse.json({ sections, settings });
});

export const PATCH = withApiErrors(async (req: Request) => {
  await requireAdmin(req);
  const updates = parseOrThrow(adminHomepageSettingsSchema, await req.json());
  const settings = await getHomepageSettings();

  const allowed = ["heroMode", "theme", "recommendationMode"] as const;
  for (const key of allowed) {
    if (key in updates) (settings as unknown as Record<string, unknown>)[key] = updates[key];
  }
  settings.updatedAt = new Date();
  await settings.save();

  return NextResponse.json({ settings });
});
