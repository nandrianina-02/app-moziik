import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAdmin } from "@/lib/requireAdmin";
import { getSiteConfig } from "@/lib/siteConfig";
import { parseOrThrow } from "@/lib/validation";

/**
 * Le classement des titres par genre, pour l'administration.
 *
 * Les propositions (`genrePropose`) sont écrites par les outils d'analyse :
 * genre habituel de l'artiste, balise du fichier, puis empreinte sonore.
 * Rien n'est appliqué sans passer par ici : l'administration accepte,
 * corrige ou rejette, et seul `genre` compte pour le site et l'application.
 *
 * GET   ?vue=propositions | a-classer | genre&g=…  &page=
 * PATCH { ids, genre } applique un genre ; { ids, accepter: true } applique
 *       la proposition de chaque titre ; { ids, rejeter: true } l'efface.
 */

const PAR_PAGE = 40;
const SANS_GENRE = { $or: [{ genre: { $in: ["Autre", "", null] } }, { genre: { $exists: false } }] };

const corpsSchema = z
  .object({
    ids: z.array(z.string().regex(/^[a-f0-9]{24}$/)).min(1).max(200),
    genre: z.string().trim().min(1).max(60).optional(),
    accepter: z.literal(true).optional(),
    rejeter: z.literal(true).optional(),
  })
  .refine((v) => [v.genre !== undefined, v.accepter, v.rejeter].filter(Boolean).length === 1, {
    message: "Un seul choix : genre, accepter ou rejeter.",
  });

const SANS_PROPOSITION = { $unset: { genrePropose: "", genreConfiance: "", genreSource: "" } };

export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin(req);
  await connectDB();
  const params = new URL(req.url).searchParams;
  const vue = params.get("vue") ?? "propositions";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const filtre: Record<string, unknown> =
    vue === "a-classer"
      ? { status: "published", genrePropose: { $exists: false }, ...SANS_GENRE }
      : vue === "genre"
        ? { status: "published", genre: params.get("g") ?? "" }
        : { status: "published", genrePropose: { $exists: true } };

  const [titres, propositions, aClasser, config] = await Promise.all([
    Song.find(filtre)
      .select("title coverUrl genre genrePropose genreConfiance genreSource artist playsCount")
      .populate("artist", "stageName")
      // Les propositions les plus sûres d'abord : ce sont celles qu'on valide en lot.
      .sort(vue === "propositions" ? { genreConfiance: -1, playsCount: -1 } : { playsCount: -1 })
      .skip((page - 1) * PAR_PAGE)
      .limit(PAR_PAGE + 1)
      .lean(),
    Song.countDocuments({ status: "published", genrePropose: { $exists: true } }),
    Song.countDocuments({ status: "published", genrePropose: { $exists: false }, ...SANS_GENRE }),
    getSiteConfig(),
  ]);

  return NextResponse.json(
    {
      titres: titres.slice(0, PAR_PAGE),
      suite: titres.length > PAR_PAGE,
      page,
      compteurs: { propositions, aClasser },
      genres: config.genres ?? [],
    },
    { headers: { "Cache-Control": "no-store" } }
  );
});

export const PATCH = withApiErrors(async (req: Request) => {
  await requireAdmin(req);
  await connectDB();
  const corps = parseOrThrow(corpsSchema, await req.json());

  if (corps.rejeter) {
    const r = await Song.updateMany({ _id: { $in: corps.ids } }, SANS_PROPOSITION);
    return NextResponse.json({ modifies: r.modifiedCount });
  }

  const genres = (await getSiteConfig()).genres ?? [];
  if (corps.genre !== undefined) {
    if (!genres.includes(corps.genre)) throw new ApiError("Ce genre n'est pas dans la liste du site.", 400);
    const r = await Song.updateMany({ _id: { $in: corps.ids } }, { $set: { genre: corps.genre }, ...SANS_PROPOSITION });
    return NextResponse.json({ modifies: r.modifiedCount });
  }

  // Accepter : chaque titre prend sa propre proposition, si elle est toujours dans la liste du site.
  const titres = await Song.find({ _id: { $in: corps.ids }, genrePropose: { $in: genres } }).select("genrePropose").lean();
  // Une écriture par genre proposé : quelques genres au plus, quel que soit le nombre de titres.
  const parGenre = new Map<string, unknown[]>();
  for (const t of titres) parGenre.set(t.genrePropose as string, [...(parGenre.get(t.genrePropose as string) ?? []), t._id]);
  for (const [genre, ids] of parGenre) {
    await Song.updateMany({ _id: { $in: ids } }, { $set: { genre }, ...SANS_PROPOSITION });
  }
  return NextResponse.json({ modifies: titres.length });
});
