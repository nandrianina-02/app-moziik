import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import { requireAdmin } from "@/lib/requireAdmin";
import { withApiErrors } from "@/lib/apiError";

/**
 * Les titres dont le tempo manque encore.
 *
 * L'analyse elle-même se fait dans le navigateur de l'administration
 * (`lib/bpm.ts`) : décoder de l'audio dans une fonction sans état
 * demanderait ffmpeg et ferait transiter tout le catalogue par le serveur,
 * pour un résultat identique. Cette route ne fait que dire quoi analyser.
 */

/** Traité par fournées : chacune se termine, et l'écran dit ce qu'il reste. */
const PAR_FOURNEE = 25;

export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin(req);

  await connectDB();

  const { searchParams } = new URL(req.url);
  const taille = Math.min(100, Math.max(1, Number(searchParams.get("limite")) || PAR_FOURNEE));

  // Un tempo saisi à la main ne se recalcule jamais. Restent ceux qui n'en
  // ont pas du tout, et ceux qu'une analyse précédente a laissés vides.
  const filtre = { bpm: { $in: [null, 0] }, bpmSource: { $ne: "manuel" } };

  const [titres, restants] = await Promise.all([
    Song.find({ $or: [filtre, { bpm: { $exists: false }, bpmSource: { $ne: "manuel" } }] })
      .select("title artist")
      .populate("artist", "stageName")
      .sort({ createdAt: -1 })
      .limit(taille)
      .lean(),
    Song.countDocuments({ $or: [filtre, { bpm: { $exists: false }, bpmSource: { $ne: "manuel" } }] }),
  ]);

  return NextResponse.json({
    titres: titres.map((t) => ({
      _id: String(t._id),
      title: t.title,
      artistName: (t.artist as { stageName?: string } | null)?.stageName ?? "Artiste inconnu",
    })),
    restants,
  });
});
