import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import HomepageHubCard from "@/models/HomepageHubCard";
import { requireAdmin } from "@/lib/requireAdmin";
import { withApiErrors } from "@/lib/apiError";
import { parseOrThrow, hubCardSchema, hubCardsReorderSchema } from "@/lib/validation";
import { getHubCards } from "@/lib/homepageHubCards";

/** Liste toutes les cartes (y compris désactivées) pour l'écran d'admin. */
export const GET = withApiErrors(async () => {
  await requireAdmin();
  const cards = await getHubCards();
  return NextResponse.json({ cards });
});

/** Crée une nouvelle carte "Pour vous", ajoutée en dernière position. */
export const POST = withApiErrors(async (req: Request) => {
  await requireAdmin();
  const { title, subtitle, badge, coverUrl, linkHref, enabled } = parseOrThrow(hubCardSchema, await req.json());

  await connectDB();
  const lastPosition = await HomepageHubCard.findOne().sort({ position: -1 }).select("position");

  const card = await HomepageHubCard.create({
    title,
    subtitle,
    badge,
    coverUrl: coverUrl || undefined,
    linkHref,
    enabled,
    position: (lastPosition?.position ?? -1) + 1,
  });

  return NextResponse.json({ card }, { status: 201 });
});

/** Réordonne les cartes : body = [{ id, position }, ...] (drag & drop admin). */
export const PATCH = withApiErrors(async (req: Request) => {
  await requireAdmin();
  const { order } = parseOrThrow(hubCardsReorderSchema, await req.json());

  await connectDB();
  await Promise.all(order.map(({ id, position }) => HomepageHubCard.findByIdAndUpdate(id, { position })));

  const cards = await HomepageHubCard.find().sort({ position: 1 });
  return NextResponse.json({ cards });
});
