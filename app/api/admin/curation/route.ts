import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Playlist from "@/models/Playlist";
import CurationRun from "@/models/CurationRun";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAdmin } from "@/lib/requireAdmin";
import { parseOrThrow, adminCurationActionSchema } from "@/lib/validation";
import { getSiteConfig } from "@/lib/siteConfig";
import { lancerAnalyseHebdomadaire, CurationIndisponible } from "@/lib/curation/run";
import { publierAnalyse, retirerAnalyse } from "@/lib/curation/publish";
import { libelleFenetre } from "@/lib/curation/window";
import { RECETTES_INFO, libelleSelection } from "@/lib/curation/labels";
import { UNIVERS, UNIVERS_INFO, normaliserUnivers, type Univers } from "@/lib/univers";

/**
 * L'état de la curation hebdomadaire, et les gestes qui la font avancer.
 *
 * GET  — la dernière analyse avec ses playlists détaillées, puis
 *        l'historique. C'est tout ce dont /admin/selections a besoin :
 *        un seul aller-retour, pas de cascade de requêtes par playlist.
 *
 * POST — analyser | publier | annuler | retirer.
 *        `publier` est le seul geste qui rend quelque chose visible du
 *        public, et il n'existe que sur cette route : ni le cron ni
 *        aucune page ne peut publier à la place d'un humain, sauf le
 *        réglage `autoPublish` que l'exploitant active lui-même.
 */

/** Analyses affichées dans l'historique. Au-delà, plus personne ne remonte. */
const HISTORIQUE_MAX = 12;

type PlaylistDoc = {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  coverUrl?: string;
  isPublic: boolean;
  songs: {
    _id: Types.ObjectId;
    title: string;
    coverUrl?: string;
    duration?: number;
    artist?: { stageName?: string };
  }[];
  followers: unknown[];
  auto?: { kind: string; mode?: string; statut: string; motif: string; rang: number };
};

/** Les playlists d'une analyse, dans l'ordre prévu pour l'accueil. */
async function playlistsDeLAnalyse(runId: Types.ObjectId, univers: Univers) {
  const playlists = (await Playlist.find({ "auto.run": runId })
    .sort({ "auto.rang": 1 })
    .populate({ path: "songs", select: "title coverUrl duration artist", populate: { path: "artist", select: "stageName" } })
    .lean()) as unknown as PlaylistDoc[];

  return playlists.map((p) => ({
    _id: p._id.toString(),
    title: p.title,
    description: p.description ?? "",
    coverUrl: p.coverUrl ?? "",
    isPublic: p.isPublic,
    followers: p.followers?.length ?? 0,
    kind: p.auto?.kind ?? "",
    // Le libellé de la recette et le titre de la playlist diffèrent dès
    // que l'IA a écrit : l'admin doit pouvoir rattacher l'un à l'autre.
    // Recette globale ou sélection de mode : le libellé se lit de la
    // même façon dans les deux cas.
    recette: p.auto ? libelleSelection(p.auto.kind, univers) : "",
    mode: p.auto?.mode ?? null,
    statut: p.auto?.statut ?? "brouillon",
    motif: p.auto?.motif ?? "",
    rang: p.auto?.rang ?? 0,
    songs: (p.songs ?? []).map((s) => ({
      _id: s._id.toString(),
      title: s.title,
      coverUrl: s.coverUrl ?? "",
      duration: s.duration ?? 0,
      artiste: s.artist?.stageName ?? "",
    })),
  }));
}

export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin(req);
  await connectDB();

  const config = await getSiteConfig();
  // L'écran montre un univers à la fois : les deux analyses de la semaine
  // portent sur des catalogues différents et se valident séparément.
  const univers = normaliserUnivers(new URL(req.url).searchParams.get("univers"));
  const courante = await CurationRun.findOne({ statut: { $ne: "echouee" }, univers }).sort({ createdAt: -1 });

  const historique = await CurationRun.find({ univers })
    .sort({ createdAt: -1 })
    .limit(HISTORIQUE_MAX)
    .select("from to statut declencheur publieeLe erreur createdAt redigeParIA")
    .lean();

  return NextResponse.json({
    reglages: config.curation ?? null,
    recettes: RECETTES_INFO,
    univers,
    universDisponibles: UNIVERS.map((u) => ({ id: u, label: UNIVERS_INFO[u].label })),
    courante: courante
      ? {
          _id: courante._id.toString(),
          from: courante.from,
          to: courante.to,
          fenetre: libelleFenetre(courante.from, courante.to),
          univers,
          statut: courante.statut,
          declencheur: courante.declencheur,
          stats: courante.stats,
          titreSection: courante.titreSection,
          resume: courante.resume,
          redigeParIA: courante.redigeParIA,
          publieeLe: courante.publieeLe ?? null,
          playlists: await playlistsDeLAnalyse(courante._id as Types.ObjectId, univers),
        }
      : null,
    historique: historique.map((h) => ({
      _id: h._id.toString(),
      fenetre: libelleFenetre(h.from, h.to),
      statut: h.statut,
      declencheur: h.declencheur,
      publieeLe: h.publieeLe ?? null,
      erreur: h.erreur ?? null,
      createdAt: h.createdAt,
    })),
  });
});

export const POST = withApiErrors(async (req: Request) => {
  const { user } = await requireAdmin(req);
  const { action, runId } = parseOrThrow(adminCurationActionSchema, await req.json());

  if (action === "analyser") {
    // Le bouton lance les deux univers d'un coup : demander à l'admin
    // lequel analyser l'obligerait à cliquer deux fois pour un geste qui
    // n'a de sens qu'entier.
    const resultat = await lancerAnalyseHebdomadaire({ declencheur: "admin", lancePar: user.id });

    // Aucun des deux n'a rien produit : « rien à proposer cette semaine »
    // n'est pas une panne, mais l'écran doit l'afficher tel quel plutôt
    // qu'annoncer une réussite vide.
    if (resultat.analyses.length === 0) {
      const raison = resultat.echecs[0]?.raison ?? "Aucune sélection n'a pu être constituée.";
      throw new ApiError(raison, 409);
    }
    return NextResponse.json(resultat);
  }

  if (!runId) throw new ApiError("Analyse non précisée.", 400);
  await connectDB();
  const run = await CurationRun.findById(runId);
  if (!run) throw new ApiError("Analyse introuvable.", 404);

  if (action === "publier") {
    if (run.statut !== "a_valider") {
      throw new ApiError("Seule une analyse en attente de validation peut être publiée.", 409);
    }
    const resultat = await publierAnalyse({ runId, publieePar: user.id });
    if (resultat.publiees === 0) {
      throw new ApiError("Aucune playlist à publier : elles sont toutes écartées ou vides.", 409);
    }
    return NextResponse.json(resultat);
  }

  if (action === "retirer") {
    if (run.statut !== "publiee") {
      throw new ApiError("Cette analyse n'est pas publiée.", 409);
    }
    const retirees = await retirerAnalyse(runId);
    return NextResponse.json({ retirees });
  }

  // annuler : abandonner une proposition sans jamais l'afficher.
  if (run.statut === "publiee") {
    throw new ApiError("Cette analyse est publiée : utilise « Retirer de l'accueil ».", 409);
  }
  await Playlist.deleteMany({ "auto.run": run._id, "auto.statut": "brouillon" });
  run.statut = "annulee";
  run.updatedAt = new Date();
  await run.save();
  return NextResponse.json({ annulee: true });
});
