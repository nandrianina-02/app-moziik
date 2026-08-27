import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import InsightReport from "@/models/InsightReport";
import { withApiErrors } from "@/lib/apiError";
import { requireAdmin } from "@/lib/requireAdmin";
import { construireRapport } from "@/lib/insights/report";
import { analyserRapport } from "@/lib/ai/analyst";

/**
 * Le rapport d'exploitation.
 *
 * GET  — recalcule tout et rend les mesures. Aucun appel au modèle : on
 *        ouvre cet écran pour regarder des chiffres, pas pour dépenser.
 *
 * POST — ajoute l'interprétation par IA au rapport courant, et l'archive.
 *        Verbe distinct parce que l'opération coûte de l'argent et
 *        compte contre le plafond journalier : une lecture ne doit
 *        jamais la déclencher par mégarde, ni un rechargement de page la
 *        répéter.
 *
 * Les chiffres viennent tous de lib/insights/ ; le modèle n'en reçoit
 * aucun et n'a pas le droit d'en écrire (voir lib/ai/analyst.ts).
 */
export const dynamic = "force-dynamic";

export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin(req);
  await connectDB();

  const rapport = await construireRapport();

  // La dernière archive, s'il y en a une pour cette fenêtre : elle porte
  // l'interprétation déjà payée, qu'il serait absurde de redemander.
  const archive = await InsightReport.findOne({ from: rapport.fenetre.from, to: rapport.fenetre.to });

  return NextResponse.json(
    {
      rapport,
      analyse: archive
        ? { lecture: archive.lecture, aRegarder: archive.aRegarder, parIA: archive.redigeParIA }
        : null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
});

export const POST = withApiErrors(async (req: Request) => {
  const { user } = await requireAdmin(req);
  await connectDB();

  const rapport = await construireRapport();
  const analyse = await analyserRapport(rapport, user.id);

  // `upsert` sur la fenêtre : relire la semaine remplace l'archive plutôt
  // que d'en empiler une deuxième pour la même période.
  await InsightReport.updateOne(
    { from: rapport.fenetre.from, to: rapport.fenetre.to },
    {
      $set: {
        libelle: rapport.fenetre.libelle,
        mesures: rapport as unknown as Record<string, unknown>,
        lecture: analyse.lecture,
        aRegarder: analyse.aRegarder,
        redigeParIA: analyse.parIA,
      },
      $setOnInsert: { from: rapport.fenetre.from, to: rapport.fenetre.to, createdAt: new Date() },
    },
    { upsert: true }
  );

  return NextResponse.json({ rapport, analyse });
});
