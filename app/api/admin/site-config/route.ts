import { NextResponse } from "next/server";
import { getSiteConfig, oublierSiteConfig } from "@/lib/siteConfig";
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
    "defaultUnivers",
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
    "anonymousDailyPlays",
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

  // `frais` : cette route modifie l'objet rendu puis l'enregistre. Partir
  // d'une valeur mémorisée reviendrait à réécrire un document vieux d'une
  // minute par-dessus des changements plus récents.
  const config = await getSiteConfig({ frais: true });
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
  // Sans cet oubli, l'instance qui vient d'enregistrer continuerait de
  // servir l'ancienne configuration jusqu'à une minute — et l'admin
  // croirait que son changement n'a pas pris.
  oublierSiteConfig();

  return NextResponse.json({ config });
});
