import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import HelpArticle from "@/models/HelpArticle";
import { withApiErrors } from "@/lib/apiError";
import { escapeRegex } from "@/lib/regex";

/**
 * Articles publiés du centre d'aide.
 *
 * Publique et sans authentification : quelqu'un qui n'arrive pas à se
 * connecter doit pouvoir lire l'article qui explique pourquoi.
 *
 * La recherche passe par une expression régulière plutôt qu'un index
 * plein texte : le corpus tient en quelques dizaines d'articles, et une
 * recherche par sous-chaîne y trouve « paiement » dans « paiements »,
 * ce que la racinisation française de MongoDB ne garantit pas.
 */
export const dynamic = "force-dynamic";

export const GET = withApiErrors(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 80);
  const category = (searchParams.get("category") ?? "").trim().slice(0, 60);
  const limit = Math.min(60, Math.max(1, Number(searchParams.get("limit")) || 60));

  await connectDB();

  const query: Record<string, unknown> = { published: true };
  if (category) query.category = category;
  if (q) {
    const motif = new RegExp(escapeRegex(q), "i");
    // La categorie fait partie du champ de recherche : taper « paiement »
    // doit remonter tout « Abonnement & paiement », pas seulement les
    // articles qui emploient le mot dans leur texte.
    query.$or = [{ title: motif }, { excerpt: motif }, { body: motif }, { category: motif }];
  }

  const articles = await HelpArticle.find(query)
    .select("title slug category excerpt position views updatedAt")
    .sort({ category: 1, position: 1, title: 1 })
    .limit(limit);

  // Les catégories réellement pourvues, dans l'ordre où elles s'affichent :
  // en proposer une vide enverrait le visiteur sur une page sans réponse.
  const categories = await HelpArticle.distinct("category", { published: true });

  return NextResponse.json(
    { articles, categories: (categories as string[]).sort((a, b) => a.localeCompare(b, "fr")) },
    { headers: { "Cache-Control": "no-store" } }
  );
});
