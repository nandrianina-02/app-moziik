import { NextResponse } from "next/server";
import { getSiteConfig } from "@/lib/siteConfig";
import { requireAdmin } from "@/lib/requireAdmin";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, adminSiteConfigPatchSchema } from "@/lib/validation";

export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin(req);
  const config = await getSiteConfig();
  return NextResponse.json({ config });
});

export const PATCH = withApiErrors(async (req: Request) => {
  await requireAdmin(req);

  const updates = parseOrThrow(adminSiteConfigPatchSchema, await req.json());
  const allowed = [
    "siteName",
    "tagline",
    "description",
    "siteUrl",
    "defaultLanguage",
    "currency",
    "timezone",
    "dateFormat",
    "logoUrl",
    "logoDarkUrl",
    "faviconUrl",
    "supportEmail",
    "copyrightText",
    "seoTitle",
    "seoDescription",
    "googleAnalyticsId",
    "googleSearchConsoleId",
    "trialDays",
    "plans",
    "genres",
    "payPerListenRateUSD",
    "theme",
    "legalEntityName",
    "legalCapital",
    "legalRcsCity",
    "legalRcsNumber",
    "legalAddress",
    "legalWebsite",
    "legalUpdatedAt",
    "socialLinks",
  ];

  const config = await getSiteConfig();
  // getSiteConfig() retombe sur un objet simple (sans .save()) quand
  // MongoDB est injoignable (voir lib/siteConfig.ts) — un admin ne peut de
  // toute façon rien enregistrer durablement dans ce cas.
  if (!("save" in config)) {
    throw new ApiError("Base de données indisponible : impossible d'enregistrer les paramètres.", 503);
  }

  const updatesRecord = updates as Record<string, unknown>;
  for (const key of allowed) {
    if (key in updatesRecord) {
      (config as unknown as Record<string, unknown>)[key] = updatesRecord[key];
    }
  }
  config.updatedAt = new Date();
  await config.save();

  return NextResponse.json({ config });
});
