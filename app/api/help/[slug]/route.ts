import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import HelpArticle from "@/models/HelpArticle";
import { ApiError, withApiErrors } from "@/lib/apiError";

/**
 * Un article, et ses voisins de catégorie.
 *
 * Le compteur de consultations est incrémenté au passage : c'est ce qui
 * permet à l'administration de voir quelles questions reviennent, donc
 * quelles réponses méritent d'être améliorées.
 */
export const dynamic = "force-dynamic";

export const GET = withApiErrors(async (_req: Request, { params }: { params: { slug: string } }) => {
  await connectDB();

  const article = await HelpArticle.findOneAndUpdate(
    { slug: params.slug, published: true },
    { $inc: { views: 1 } },
    { new: true }
  ).select("title slug category excerpt body views updatedAt");

  if (!article) throw new ApiError("Article introuvable.", 404);

  const voisins = await HelpArticle.find({
    category: article.category,
    published: true,
    _id: { $ne: article._id },
  })
    .select("title slug excerpt")
    .sort({ position: 1, title: 1 })
    .limit(5);

  return NextResponse.json({ article, voisins }, { headers: { "Cache-Control": "no-store" } });
});
