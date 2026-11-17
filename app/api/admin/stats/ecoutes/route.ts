import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Play from "@/models/Play";
import { requireAdmin } from "@/lib/requireAdmin";
import { withApiErrors } from "@/lib/apiError";

const JOUR_MS = 24 * 60 * 60 * 1000;

/**
 * Les écoutes jour par jour sur les N derniers jours, et le total de la
 * fenêtre précédente de même durée : la courbe « Évolution des écoutes »
 * du logiciel d'administration et son évolution en pourcentage.
 *
 * Toutes les écoutes comptent, achevées ou non, dans les deux univers :
 * c'est l'activité de la plateforme, pas le classement (qui, lui, ne
 * retient que les écoutes achevées d'un univers). Les jours sans écoute
 * valent zéro plutôt que d'être omis, sans quoi la courbe relierait deux
 * points éloignés comme s'ils étaient voisins.
 */
export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin(req);

  const { searchParams } = new URL(req.url);
  const jours = Math.min(365, Math.max(7, Number(searchParams.get("days") ?? 30) || 30));
  const maintenant = Date.now();
  const depuis = new Date(maintenant - jours * JOUR_MS);
  const avant = new Date(maintenant - 2 * jours * JOUR_MS);

  await connectDB();
  const [parJour, precedent] = await Promise.all([
    Play.aggregate<{ _id: string; ecoutes: number }>([
      { $match: { playedAt: { $gte: depuis } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$playedAt" } }, ecoutes: { $sum: 1 } } },
    ]),
    Play.countDocuments({ playedAt: { $gte: avant, $lt: depuis } }),
  ]);

  const index = new Map(parJour.map((l) => [l._id, l.ecoutes]));
  const serie: { date: string; plays: number }[] = [];
  for (let i = jours - 1; i >= 0; i--) {
    const date = new Date(maintenant - i * JOUR_MS).toISOString().slice(0, 10);
    serie.push({ date, plays: index.get(date) ?? 0 });
  }
  const total = serie.reduce((somme, j) => somme + j.plays, 0);

  return NextResponse.json({
    days: jours,
    total,
    previousTotal: precedent,
    trendPct: precedent > 0 ? Math.round(((total - precedent) / precedent) * 1000) / 10 : null,
    series: serie,
  });
});
