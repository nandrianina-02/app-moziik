import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import HomepageSection from "@/models/HomepageSection";
import { requireAdmin } from "@/lib/requireAdmin";
import { slugify, sectionSlug } from "@/lib/homepageSections";
import { parseSectionPage } from "@/lib/sectionPage";
import { withApiErrors } from "@/lib/apiError";
import { parseOrThrow, adminHomepageSectionReorderSchema, adminHomepageSectionCreateSchema } from "@/lib/validation";

/** Réordonne les sections : body = [{ id, position }, ...] (issu du drag & drop admin). */
export const PATCH = withApiErrors(async (req: Request) => {
  await requireAdmin(req);
  const { order } = parseOrThrow(adminHomepageSectionReorderSchema, await req.json());
  const page = parseSectionPage(new URL(req.url).searchParams.get("page"));

  await connectDB();
  await Promise.all(
    order.map(({ id, position }) => HomepageSection.findByIdAndUpdate(id, { position, updatedAt: new Date() }))
  );

  const sections = await HomepageSection.find({ page }).sort({ position: 1 });
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
  const { title, limit, page: bodyPage } = parseOrThrow(adminHomepageSectionCreateSchema, await req.json());
  const page = parseSectionPage(bodyPage);

  await connectDB();

  // Le slug reste unique à l'échelle du site (voir sectionSlug) : l'index
  // unique existant en base n'a donc pas à être reconstruit.
  let slug = sectionSlug(page, slugify(title));
  if (await HomepageSection.exists({ slug })) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const lastPosition = await HomepageSection.findOne({ page }).sort({ position: -1 }).select("position");

  const section = await HomepageSection.create({
    key: "custom",
    page,
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
