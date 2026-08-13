import { NextResponse } from "next/server";
import { getSiteConfig } from "@/lib/siteConfig";
import { withApiErrors } from "@/lib/apiError";

// Sans ça, cette route (qui ne lit ni cookies ni headers) est traitée
// comme statique par Next.js et figée au build : les modifications de
// l'admin (ex. changement de logo) en base ne seraient jamais reflétées.
export const dynamic = "force-dynamic";

export const GET = withApiErrors(async () => {
  const config = await getSiteConfig();
  return NextResponse.json(
    {
      siteName: config.siteName,
      tagline: config.tagline,
      logoUrl: config.logoUrl,
      supportEmail: config.supportEmail,
      copyrightText: config.copyrightText,
      plans: config.plans,
      genres: config.genres,
      legalEntityName: config.legalEntityName,
      legalCapital: config.legalCapital,
      legalRcsCity: config.legalRcsCity,
      legalRcsNumber: config.legalRcsNumber,
      legalAddress: config.legalAddress,
      legalWebsite: config.legalWebsite,
      legalUpdatedAt: config.legalUpdatedAt,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
});
