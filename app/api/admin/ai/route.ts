import { NextResponse } from "next/server";
import { getSiteConfig } from "@/lib/siteConfig";
import { requireAdmin } from "@/lib/requireAdmin";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, adminAiSettingsSchema } from "@/lib/validation";
import { cleConfiguree } from "@/lib/ai/client";
import { FONCTIONNALITES_IA, IDS_FONCTIONNALITES_IA, PLAFOND_JOURNALIER_DEFAUT } from "@/lib/ai/features";
import { usageRecent } from "@/lib/ai/usage";

/**
 * Réglages et consommation de l'assistance par IA.
 *
 * Le catalogue des fonctionnalités est renvoyé avec les réglages, et non
 * recopié dans la page : la liste affichée est alors exactement celle que
 * le code applique, jusqu'au modèle employé par chacune.
 *
 * La clé d'API n'est jamais renvoyée, ni même partiellement — seulement
 * le fait qu'elle soit renseignée. C'est la seule information dont
 * l'administration a besoin pour comprendre pourquoi rien ne répond.
 */
export const dynamic = "force-dynamic";

export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin(req);

  const config = await getSiteConfig();
  const reglages = config.ai ?? { enabled: true, disabled: [], dailyCallCap: PLAFOND_JOURNALIER_DEFAUT };
  const usage = await usageRecent(30);

  return NextResponse.json(
    {
      cleConfiguree: cleConfiguree(),
      reglages: {
        enabled: reglages.enabled !== false,
        disabled: reglages.disabled ?? [],
        dailyCallCap: reglages.dailyCallCap ?? PLAFOND_JOURNALIER_DEFAUT,
      },
      fonctionnalites: IDS_FONCTIONNALITES_IA.map((id) => ({
        id,
        label: FONCTIONNALITES_IA[id].label,
        detail: FONCTIONNALITES_IA[id].detail,
        niveau: FONCTIONNALITES_IA[id].niveau,
        acces: FONCTIONNALITES_IA[id].acces,
      })),
      usage,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
});

export const PATCH = withApiErrors(async (req: Request) => {
  await requireAdmin(req);

  const updates = parseOrThrow(adminAiSettingsSchema, await req.json());

  const config = await getSiteConfig();
  if (!("save" in config)) {
    throw new ApiError("Base de données indisponible : impossible d'enregistrer les réglages.", 503);
  }

  const actuels = config.ai ?? { enabled: true, disabled: [], dailyCallCap: PLAFOND_JOURNALIER_DEFAUT };
  config.ai = {
    enabled: updates.enabled ?? actuels.enabled !== false,
    disabled: updates.disabled ?? actuels.disabled ?? [],
    dailyCallCap: updates.dailyCallCap ?? actuels.dailyCallCap ?? PLAFOND_JOURNALIER_DEFAUT,
  };
  config.updatedAt = new Date();
  await config.save();

  return NextResponse.json({ reglages: config.ai });
});
