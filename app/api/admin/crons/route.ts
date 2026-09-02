import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { TACHES_PLANIFIEES, estTachePlanifiee } from "@/lib/tachesPlanifiees";

import { POST as publierTitres } from "@/app/api/cron/publish-songs/route";
import { POST as modererCommentaires } from "@/app/api/cron/moderate-comments/route";
import { POST as calculerDroits } from "@/app/api/cron/compute-royalties/route";
import { POST as analyseHebdo } from "@/app/api/cron/weekly-curation/route";
import { POST as rapportHebdo } from "@/app/api/cron/weekly-report/route";

/**
 * Lancer une tâche planifiée à la main, depuis l'administration.
 *
 * Les cinq tâches sont déclenchées par un ordonnanceur externe, qui
 * s'authentifie avec `CRON_SECRET`. Jusqu'ici, les relancer après un
 * incident demandait de retrouver ce secret et de fabriquer une requête à
 * la main — ou d'attendre le lendemain.
 *
 * Le traitement appelé est **exactement** celui du cron : le gestionnaire
 * de route est importé et invoqué directement, avec une requête portant le
 * secret lu côté serveur. Recopier la logique ici aurait créé une seconde
 * version à maintenir, qui aurait fini par diverger de celle qui tourne
 * vraiment la nuit.
 */

const HANDLERS: Record<string, (req: Request) => Promise<Response>> = {
  "publish-songs": publierTitres,
  "moderate-comments": modererCommentaires,
  "compute-royalties": calculerDroits,
  "weekly-curation": analyseHebdo,
  "weekly-report": rapportHebdo,
};

/**
 * Plafond aligné sur la plus longue des tâches.
 *
 * L'appel de l'administration attend la fin du traitement : sa durée est
 * donc celle de la tâche, pas la sienne.
 */
export const maxDuration = 300;

/** Le catalogue des tâches, pour que l'écran n'ait rien à savoir d'elles. */
export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin(req);
  return NextResponse.json({ taches: TACHES_PLANIFIEES });
});

export const POST = withApiErrors(async (req: Request) => {
  await requireAdmin(req);

  if (!process.env.CRON_SECRET) {
    throw new ApiError(
      "CRON_SECRET n'est pas configuré côté serveur : les tâches refuseraient de démarrer.",
      500
    );
  }

  const { tache, univers } = (await req.json().catch(() => ({}))) as {
    tache?: string;
    univers?: string;
  };
  if (!tache || !estTachePlanifiee(tache)) throw new ApiError("Tâche inconnue.", 400);

  // La requête transmise porte le secret que l'ordonnanceur enverrait, et
  // une adresse absolue — `weekly-curation` y lit son paramètre d'univers.
  const base = new URL(req.url).origin;
  const parametres = univers ? `?univers=${encodeURIComponent(univers)}` : "";
  const requete = new Request(`${base}/api/cron/${tache}${parametres}`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });

  const debut = Date.now();
  const reponse = await HANDLERS[tache](requete);
  const resultat = await reponse.json().catch(() => null);

  // Le statut de la tâche est renvoyé tel quel dans le corps plutôt que
  // propagé : un 409 « déjà en cours » n'est pas une erreur de l'appel
  // d'administration, et l'écran doit pouvoir l'afficher comme un
  // résultat.
  return NextResponse.json({
    tache,
    ok: reponse.ok,
    statut: reponse.status,
    dureeMs: Date.now() - debut,
    resultat,
  });
});
