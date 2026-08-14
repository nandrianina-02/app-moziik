import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import HomepageSection from "@/models/HomepageSection";
import HomepagePinned from "@/models/HomepagePinned";
import { requireAdmin } from "@/lib/requireAdmin";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, adminHomepageSectionPatchSchema } from "@/lib/validation";

export const PATCH = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  await requireAdmin(req);
  const updates = parseOrThrow(adminHomepageSectionPatchSchema, await req.json());

  await connectDB();
  const section = await HomepageSection.findById(params.id);
  if (!section) throw new ApiError("Section introuvable.", 404);

  if (section.key === "custom" && updates.mode === "auto") {
    throw new ApiError("Une section personnalisée n'a pas d'algorithme automatique : elle reste toujours pilotée par le contenu épinglé.");
  }

  const allowed = ["title", "enabled", "mode", "limit", "filters"] as const;
  for (const key of allowed) {
    if (key in updates) (section as unknown as Record<string, unknown>)[key] = updates[key];
  }
  section.updatedAt = new Date();
  await section.save();

  return NextResponse.json({ section });
});

/** Supprime une section personnalisée (et son contenu épinglé associé). Les 12 types fixes ne peuvent pas être supprimés, seulement désactivés. */
export const DELETE = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  await requireAdmin(req);
  await connectDB();

  const section = await HomepageSection.findById(params.id);
  if (!section) throw new ApiError("Section introuvable.", 404);
  if (section.key !== "custom") {
    throw new ApiError("Les sections intégrées ne peuvent pas être supprimées, seulement désactivées.");
  }

  await HomepagePinned.deleteMany({ section: section.slug ?? section.key });
  await section.deleteOne();

  return NextResponse.json({ success: true });
});
