import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import InsightReport from "@/models/InsightReport";
import User from "@/models/User";
import { withApiErrors, ApiError } from "@/lib/apiError";
import { notifyMany } from "@/lib/notify";
import { construireRapport } from "@/lib/insights/report";
import { analyserRapport } from "@/lib/ai/analyst";

export const dynamic = "force-dynamic";

/**
 * Le rapport hebdomadaire, établi et archivé sans qu'on le demande.
 *
 * À appeler une fois par semaine avec
 * `Authorization: Bearer <CRON_SECRET>`, le lundi de préférence — la
 * fenêtre couvre alors les sept jours pleins de la semaine écoulée, la
 * même que celle de la curation.
 *
 * Il ARCHIVE et NOTIFIE, il ne décide de rien : aucune donnée du site
 * n'est modifiée, aucun contenu n'est publié ou masqué. C'est un
 * document, pas une action.
 */
export const POST = withApiErrors(async (req: Request) => {
  if (!process.env.CRON_SECRET) {
    throw new ApiError("CRON_SECRET n'est pas configuré côté serveur.", 500);
  }
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    throw new ApiError("Non autorisé.", 401);
  }

  await connectDB();

  const rapport = await construireRapport();
  // `compte: "cron"` : personne n'a demandé cet appel, mais la cadence
  // doit quand même se compter quelque part.
  const analyse = await analyserRapport(rapport, "cron");

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

  const admins = await User.find({ role: "admin" }).select("_id");
  if (admins.length > 0) {
    // Le message porte le fait marquant, pas les chiffres : ils sont dans
    // le rapport, et une notification tronquée qui en cite un de travers
    // vaut moins que pas de chiffre du tout.
    const alertes = rapport.anomalies.length;
    await notifyMany(
      admins.map((a) => a._id.toString()),
      {
        type: "system",
        title: "Rapport hebdomadaire",
        message:
          alertes > 0
            ? `Le rapport ${rapport.fenetre.libelle} est prêt. ${alertes} point(s) d'attention y sont relevés.`
            : `Le rapport ${rapport.fenetre.libelle} est prêt. Rien d'inhabituel n'a été relevé.`,
        link: "/admin/analyses",
      }
    );
  }

  return NextResponse.json({
    fenetre: rapport.fenetre.libelle,
    anomalies: rapport.anomalies.length,
    redigeParIA: analyse.parIA,
    previsionDisponible: rapport.prevision !== null,
  });
});

/**
 * Durée maximale d'exécution. Agrégations sur toute la période, et appels au modèle pour la lecture des mesures.
 *
 * Au-delà de la valeur par défaut de l'hébergeur, l'exécution serait
 * coupée en plein milieu — et une analyse interrompue laisse un verrou
 * derrière elle (voir lib/curation/run.ts).
 */
export const maxDuration = 300;

/**
 * Vercel Cron déclenche en GET, sans corps.
 *
 * Le même traitement répond aux deux verbes : POST reste employé par un
 * ordonnanceur externe ou un appel à la main, GET par la planification de
 * l'hébergeur. Le contrôle du secret est dans le corps commun, si bien
 * qu'ouvrir ce verbe n'ouvre rien à personne.
 */
export const GET = POST;
