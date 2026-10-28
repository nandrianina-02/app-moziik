import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import Album from "@/models/Album";
import { withApiErrors } from "@/lib/apiError";
import { requireAdmin } from "@/lib/requireAdmin";
import { parseOrThrow } from "@/lib/validation";
import { oublierSectionsPubliees } from "@/lib/cacheSections";
import { ANNEES_DOUTEUSES } from "@/lib/adminQualite";

/**
 * Les années de sortie douteuses, pour l'administration.
 *
 * Beaucoup de titres importés ont reçu comme date de sortie celle de leur
 * import. Or l'année sert la suite automatique (même époque), la Nostalgie
 * et les Nouveautés. Est douteux un titre publié, à l'année non confirmée,
 * dont la sortie tombe à deux jours de son ajout, ou classé Nostalgie avec
 * une sortie récente. Les titres sont regroupés par album (à défaut, par
 * artiste) : une année se donne en général à un album entier.
 *
 * GET   ?page=
 * PATCH { ids, annee } fixe l'année ; { ids, confirmer: true } garde la date actuelle.
 */

const GROUPES_PAR_PAGE = 15;

const corpsSchema = z
  .object({
    ids: z.array(z.string().regex(/^[a-f0-9]{24}$/)).min(1).max(200),
    annee: z.number().int().min(1950).max(new Date().getUTCFullYear()).optional(),
    confirmer: z.literal(true).optional(),
  })
  .refine((v) => (v.annee !== undefined) !== (v.confirmer === true), { message: "Un seul choix : année ou confirmer." });

const DOUTEUX = ANNEES_DOUTEUSES;

export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin(req);
  await connectDB();
  const page = Math.max(1, Number(new URL(req.url).searchParams.get("page")) || 1);

  const [groupes, compte] = await Promise.all([
    Song.aggregate([
      { $match: DOUTEUX },
      { $sort: { title: 1 } },
      {
        $group: {
          _id: { $ifNull: ["$album", "$artist"] },
          album: { $first: "$album" },
          artist: { $first: "$artist" },
          titres: { $push: { _id: "$_id", title: "$title", coverUrl: "$coverUrl", genre: "$genre", releaseDate: "$releaseDate", createdAt: "$createdAt" } },
          ecoutes: { $sum: "$playsCount" },
        },
      },
      // Les groupes les plus écoutés d'abord : ce sont eux qui pèsent dans les suggestions.
      { $sort: { ecoutes: -1, _id: 1 } },
      { $skip: (page - 1) * GROUPES_PAR_PAGE },
      { $limit: GROUPES_PAR_PAGE + 1 },
      { $lookup: { from: "albums", localField: "album", foreignField: "_id", as: "album", pipeline: [{ $project: { title: 1 } }] } },
      { $lookup: { from: "artists", localField: "artist", foreignField: "_id", as: "artist", pipeline: [{ $project: { stageName: 1 } }] } },
      { $set: { album: { $first: "$album" }, artist: { $first: "$artist" } } },
    ]),
    Song.countDocuments(DOUTEUX),
  ]);

  return NextResponse.json(
    { groupes: groupes.slice(0, GROUPES_PAR_PAGE), suite: groupes.length > GROUPES_PAR_PAGE, page, compte },
    { headers: { "Cache-Control": "no-store" } }
  );
});

export const PATCH = withApiErrors(async (req: Request) => {
  await requireAdmin(req);
  await connectDB();
  const corps = parseOrThrow(corpsSchema, await req.json());
  const maintenant = new Date();

  if (corps.confirmer) {
    const r = await Song.updateMany({ _id: { $in: corps.ids } }, { $set: { anneeVerifiee: maintenant } });
    return NextResponse.json({ modifies: r.modifiedCount });
  }

  // Seule l'année est connue : le 1er janvier, sans prétendre à un jour exact.
  const sortie = new Date(Date.UTC(corps.annee as number, 0, 1));
  const r = await Song.updateMany({ _id: { $in: corps.ids } }, { $set: { releaseDate: sortie, anneeVerifiee: maintenant } });
  // L'album suit ses titres : sa page affiche la même année.
  const albums = await Song.distinct("album", { _id: { $in: corps.ids }, album: { $ne: null } });
  if (albums.length > 0) await Album.updateMany({ _id: { $in: albums } }, { $set: { releaseDate: sortie } });
  oublierSectionsPubliees();
  return NextResponse.json({ modifies: r.modifiedCount });
});
