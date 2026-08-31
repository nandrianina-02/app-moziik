import { NextResponse } from "next/server";
import { withApiErrors, ApiError } from "@/lib/apiError";
import { lancerAnalyseHebdomadaire, CurationIndisponible } from "@/lib/curation/run";
import { purgerJournal } from "@/lib/searchJournal";

/**
 * Analyse hebdomadaire des écoutes, des recherches et des sorties.
 *
 * À appeler une fois par semaine avec
 * `Authorization: Bearer <CRON_SECRET>` — le lundi convient : la fenêtre
 * couvre alors les sept jours pleins de la semaine écoulée.
 *
 * CE QU'UNE EXÉCUTION PRODUIT
 *
 * Pour chacun des deux univers : les sélections générales de la semaine,
 * puis jusqu'à trois playlists par mode d'écoute actif — les plus
 * écoutées, celles qui montent, les nouveautés. Chaque groupe reçoit son
 * nom et sa description du modèle, par lots de dix, et sa propre section
 * d'accueil. Les sélections de la semaine précédente sont archivées à la
 * publication, jamais supprimées tant que quelqu'un les suit.
 *
 * Un mode qui n'a pas de quoi réunir cinq titres ne produit rien et
 * n'affiche aucune section : c'est le cas normal d'un catalogue jeune, et
 * de la plupart des modes d'un univers évangélique qui démarre.
 *
 * Elle PRODUIT, elle ne publie pas. Les playlists arrivent en brouillon
 * dans /admin/selections, et rien n'apparaît sur l'accueil tant qu'un
 * humain n'a pas validé — sauf si `autoPublish` a été activé dans les
 * réglages, en connaissance de cause.
 */
export const POST = withApiErrors(async (req: Request) => {
  if (!process.env.CRON_SECRET) {
    // Même échec bruyant que les autres crons : sans cette variable, la
    // comparaison rejetterait tous les appels valides sans jamais dire
    // pourquoi.
    throw new ApiError("CRON_SECRET n'est pas configuré côté serveur.", 500);
  }
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    throw new ApiError("Non autorisé.", 401);
  }

  // Le ménage du journal des recherches d'abord : il doit avoir lieu même
  // les semaines où l'analyse ne trouve rien à proposer, sinon la
  // collection ne serait jamais purgée.
  const journalPurge = await purgerJournal();

  try {
    // Les deux univers sont analysés à la suite. Un univers sans résultat
    // — catalogue trop mince, semaine trop calme — figure dans `echecs`
    // sans empêcher l'autre d'aboutir.
    const resultat = await lancerAnalyseHebdomadaire({ declencheur: "cron" });
    for (const echec of resultat.echecs) {
      console.warn(`[curation] univers ${echec.univers} sans résultat : ${echec.raison}`);
    }
    return NextResponse.json({ ...resultat, journalPurge });
  } catch (err) {
    // Une semaine trop calme pour remplir la moindre sélection n'est pas
    // une panne : le cron doit renvoyer 200, sans quoi l'ordonnanceur
    // signalera un échec chaque semaine creuse et l'alerte finira par
    // être ignorée le jour où elle compte.
    if (err instanceof CurationIndisponible) {
      console.warn("[curation] analyse hebdomadaire sans résultat :", err.message);
      return NextResponse.json({ analyses: [], playlists: 0, raison: err.message, journalPurge });
    }
    throw err;
  }
});
