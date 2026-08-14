import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import HomepageSection from "@/models/HomepageSection";
import { requireAdmin } from "@/lib/requireAdmin";
import { slugify } from "@/lib/homepageSections";
import { withApiErrors } from "@/lib/apiError";
import { parseOrThrow, adminHomepageSectionReorderSchema, adminHomepageSectionCreateSchema } from "@/lib/validation";

/** Réordonne les sections : body = [{ id, position }, ...] (issu du drag & drop admin). */
export const PATCH = withApiErrors(async (req: Request) => {
  await requireAdmin(req);
  const { order } = parseOrThrow(adminHomepageSectionReorderSchema, await req.json());

  await connectDB();
  await Promise.all(
    order.map(({ id, position }) => HomepageSection.findByIdAndUpdate(id, { position, updatedAt: new Date() }))
  );

  const sections = await HomepageSection.find().sort({ position: 1 });
  return NextResponse.json({ sections });
});

/**
 * Crée une section personnalisée : une collection libre (mélange de titres,
 * albums, artistes, playlists ou évènements) toujours pilotée en mode
 * manuel via le contenu épinglé, puisqu'aucun algorithme du moteur ne
 * s'applique à un contenu arbitraire choisi par l'admin.
 */
export const POST = withApiErrors(async (req: Request) => {
  await requireAdmin(req);
  const { title, limit } = parseOrThrow(adminHomepageSectionCreateSchema, await req.json());

  await connectDB();

  let slug = slugify(title);
  if (await HomepageSection.exists({ slug })) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const lastPosition = await HomepageSection.findOne().sort({ position: -1 }).select("position");

  const section = await HomepageSection.create({
    key: "custom",
    slug,
    title: title.trim(),
    enabled: true,
    position: (lastPosition?.position ?? 0) + 1,
    mode: "manual",
    algorithm: "manual",
    limit: limit && limit > 0 ? limit : 8,
    filters: { publicOnly: true, verifiedOnly: false, premiumOnly: false },
  });

  return NextResponse.json({ section }, { status: 201 });
});
