import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import HelpArticle from "@/models/HelpArticle";
import { requireAdmin } from "@/lib/requireAdmin";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, helpArticleCreateSchema } from "@/lib/validation";
import { ARTICLES_DEPART, resumeAuto, slugAide } from "@/lib/helpCenter";

export const dynamic = "force-dynamic";

/** Slug libre : « creer-un-compte », puis « creer-un-compte-2 », etc. */
async function slugDisponible(titre: string): Promise<string> {
  const base = slugAide(titre);
  for (let n = 1; n < 50; n++) {
    const candidat = n === 1 ? base : `${base}-${n}`;
    if (!(await HelpArticle.exists({ slug: candidat }))) return candidat;
  }
  throw new ApiError("Impossible de générer un identifiant pour ce titre.");
}

/** Tous les articles, brouillons compris. */
export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin(req);
  await connectDB();

  const articles = await HelpArticle.find({}).sort({ category: 1, position: 1, title: 1 });
  return NextResponse.json({ articles, disponibleAuDepart: ARTICLES_DEPART.length });
});

export const POST = withApiErrors(async (req: Request) => {
  await requireAdmin(req);
  const corps = (await req.json()) as Record<string, unknown>;

  await connectDB();

  // Installation du contenu de départ. Volontairement déclenchée par
  // l'administration plutôt qu'automatiquement : rien ne doit apparaître
  // en base sans qu'on l'ait demandé. Relançable sans risque, les titres
  // déjà présents sont ignorés.
  if (corps?.action === "installer-contenu-depart") {
    const crees: string[] = [];
    let position = await HelpArticle.countDocuments({});
    for (const modele of ARTICLES_DEPART) {
      const slug = slugAide(modele.title);
      if (await HelpArticle.exists({ slug })) continue;
      await HelpArticle.create({
        title: modele.title,
        slug,
        category: modele.category,
        excerpt: modele.excerpt,
        body: modele.body,
        position: position++,
        published: true,
      });
      crees.push(modele.title);
    }
    return NextResponse.json({ crees, ignores: ARTICLES_DEPART.length - crees.length });
  }

  const donnees = parseOrThrow(helpArticleCreateSchema, corps);
  const article = await HelpArticle.create({
    ...donnees,
    slug: await slugDisponible(donnees.title),
    excerpt: donnees.excerpt?.trim() || resumeAuto(donnees.body),
    position: donnees.position ?? (await HelpArticle.countDocuments({ category: donnees.category })),
  });

  return NextResponse.json({ article }, { status: 201 });
});
