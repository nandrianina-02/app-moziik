import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Play from "@/models/Play";
import { requireAdmin } from "@/lib/requireAdmin";
import { withApiErrors } from "@/lib/apiError";

/**
 * D'où l'on écoute Moziik.
 *
 * Le pays est déjà relevé à chaque écoute, à partir des en-têtes de
 * géolocalisation de la périphérie (voir /api/songs/[id]/play) : aucune
 * adresse IP n'est conservée, seulement le code pays. Cette route se
 * contente donc de compter ce qui est déjà là.
 *
 * Les écoutes sans pays connu — développement local, ou visiteur derrière
 * un réseau que la périphérie ne sait pas situer — sont regroupées sous
 * « Inconnu » plutôt que silencieusement retirées : sans quoi les
 * pourcentages mentiraient.
 */
export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin(req);

  const { searchParams } = new URL(req.url);
  const jours = Math.min(365, Math.max(1, Number(searchParams.get("days") ?? 30) || 30));
  const depuis = new Date(Date.now() - jours * 24 * 60 * 60 * 1000);

  await connectDB();
  const lignes = await Play.aggregate<{ _id: string | null; ecoutes: number; auditeurs: string[] }>([
    { $match: { playedAt: { $gte: depuis } } },
    { $group: { _id: "$country", ecoutes: { $sum: 1 }, auditeurs: { $addToSet: "$user" } } },
    { $sort: { ecoutes: -1 } },
    { $limit: 12 },
  ]);

  const total = lignes.reduce((somme, l) => somme + l.ecoutes, 0);

  return NextResponse.json({
    days: jours,
    total,
    countries: lignes.map((l) => ({
      code: l._id ?? null,
      plays: l.ecoutes,
      // Les écoutes anonymes n'ont pas d'utilisateur : elles ne comptent
      // pas comme un auditeur identifié.
      listeners: l.auditeurs.filter(Boolean).length,
      share: total > 0 ? Math.round((l.ecoutes / total) * 1000) / 10 : 0,
    })),
  });
});
