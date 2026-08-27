import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { withApiErrors } from "@/lib/apiError";
import { getSiteConfig } from "@/lib/siteConfig";
import { parseOrThrow, aiHelpDraftSchema } from "@/lib/validation";
import { redigerArticleAide } from "@/lib/ai/helpArticle";

/**
 * Brouillon d'article du centre d'aide.
 *
 * Rien n'est enregistré : le texte revient dans le formulaire, où il se
 * corrige puis se publie comme un article écrit à la main. Ce qui manque
 * y est marqué [À COMPLÉTER] et repris dans `aVerifier` — un article
 * d'aide décrit ce que le site fait, et ce qui n'a pas été dit à l'IA ne
 * doit pas être comblé par une formule plausible.
 */
export const dynamic = "force-dynamic";

export const POST = withApiErrors(async (req: Request) => {
  const { user: admin } = await requireAdmin(req);
  const { title, category, notes, body } = parseOrThrow(aiHelpDraftSchema, await req.json());

  const config = await getSiteConfig();

  const brouillon = await redigerArticleAide({
    titre: title,
    categorie: category,
    notes,
    corpsActuel: body,
    siteName: config.siteName,
    compte: admin.id,
  });

  return NextResponse.json({ brouillon }, { headers: { "Cache-Control": "no-store" } });
});
