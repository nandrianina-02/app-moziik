import { NextResponse } from "next/server";
import { getSiteConfig } from "@/lib/siteConfig";
import { requireAdmin } from "@/lib/requireAdmin";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, adminCurationSettingsSchema } from "@/lib/validation";

/**
 * Réglages de la curation hebdomadaire.
 *
 * Séparés de /api/admin/curation, qui porte l'état et les gestes : un
 * réglage se change à tout moment, y compris pendant qu'une analyse
 * attend d'être validée, et l'enregistrer ne doit rien déclencher.
 */
export const dynamic = "force-dynamic";

const DEFAUTS = {
  enabled: true,
  autoPublish: false,
  retentionWeeks: 4,
  disabled: [] as string[],
  sectionPosition: 6,
};

export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin(req);
  const config = await getSiteConfig();
  const r = config.curation ?? DEFAUTS;

  return NextResponse.json(
    {
      reglages: {
        enabled: r.enabled !== false,
        autoPublish: r.autoPublish === true,
        retentionWeeks: r.retentionWeeks ?? DEFAUTS.retentionWeeks,
        disabled: r.disabled ?? [],
        sectionPosition: r.sectionPosition ?? DEFAUTS.sectionPosition,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
});

export const PATCH = withApiErrors(async (req: Request) => {
  await requireAdmin(req);
  const updates = parseOrThrow(adminCurationSettingsSchema, await req.json());

  const config = await getSiteConfig();
  if (!("save" in config)) {
    throw new ApiError("Base de données indisponible : impossible d'enregistrer les réglages.", 503);
  }

  const actuels = config.curation ?? DEFAUTS;
  config.curation = {
    enabled: updates.enabled ?? actuels.enabled !== false,
    autoPublish: updates.autoPublish ?? actuels.autoPublish === true,
    retentionWeeks: updates.retentionWeeks ?? actuels.retentionWeeks ?? DEFAUTS.retentionWeeks,
    disabled: updates.disabled ?? actuels.disabled ?? [],
    sectionPosition: updates.sectionPosition ?? actuels.sectionPosition ?? DEFAUTS.sectionPosition,
  };
  config.updatedAt = new Date();
  await config.save();

  return NextResponse.json({ reglages: config.curation });
});
