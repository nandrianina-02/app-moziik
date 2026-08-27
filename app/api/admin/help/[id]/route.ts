import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import HelpArticle from "@/models/HelpArticle";
import { requireAdmin } from "@/lib/requireAdmin";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, helpArticlePatchSchema } from "@/lib/validation";
import { resumeAuto } from "@/lib/helpCenter";

export const dynamic = "force-dynamic";

function idValide(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError("Identifiant d'article invalide.");
}

export const PATCH = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  await requireAdmin(req);
  idValide(params.id);

  const updates = parseOrThrow(helpArticlePatchSchema, await req.json());

  await connectDB();
  const article = await HelpArticle.findById(params.id);
  if (!article) throw new ApiError("Article introuvable.", 404);

  // Le slug ne suit pas le titre : il est déjà dans des URL partagées, et
  // le changer casserait les liens existants sans prévenir personne.
  if (updates.title !== undefined) article.title = updates.title;
  if (updates.category !== undefined) article.category = updates.category;
  if (updates.body !== undefined) article.body = updates.body;
  if (updates.excerpt !== undefined) {
    article.excerpt = updates.excerpt.trim() || resumeAuto(updates.body ?? article.body);
  }
  if (updates.position !== undefined) article.position = updates.position;
  if (updates.published !== undefined) article.published = updates.published;
  article.updatedAt = new Date();

  await article.save();
  return NextResponse.json({ article });
});

export const DELETE = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  await requireAdmin(req);
  idValide(params.id);

  await connectDB();
  const supprime = await HelpArticle.findByIdAndDelete(params.id);
  if (!supprime) throw new ApiError("Article introuvable.", 404);

  return NextResponse.json({ ok: true });
});
