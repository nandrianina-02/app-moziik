import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import Artist from "@/models/Artist";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAdmin } from "@/lib/requireAdmin";
import { escapeRegex } from "@/lib/regex";
import { estUnivers, UNIVERS, UNIVERS_INFO, type Univers } from "@/lib/univers";
import { detecterUnivers } from "@/lib/universDetection";
import { classerArtiste, classerTitre, classerCatalogue } from "@/lib/universClassify";
import { etatIA } from "@/lib/ai/client";

/**
 * Le classement général / évangélique, côté administration.
 *
 * GET   — l'état du catalogue : combien de chaque côté, et la liste des
 *         artistes avec ce qui a produit leur classement.
 * PATCH — déplacer un artiste ou un titre. Une décision humaine : elle
 *         est marquée `admin` et plus aucune détection ne la réécrit.
 * POST  — relancer la détection sur tout le catalogue.
 *
 * CE QUE LE DÉPLACEMENT D'UN ARTISTE ENTRAÎNE
 *
 * Tous ses titres et tous ses albums le suivent — sauf les titres qu'un
 * admin a déjà déplacés à la main. C'est la règle demandée, et l'écran le
 * dit avant de l'appliquer : sans cela, changer un artiste donnerait
 * l'impression de n'avoir touché qu'une ligne.
 */

const PAR_PAGE = 25;

export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin(req);
  await connectDB();

  const { searchParams } = new URL(req.url);

  // Les titres d'un artiste, quand l'écran déplie une ligne. C'est le seul
  // endroit où un titre se déplace seul, et il faut voir lesquels ont déjà
  // été détachés de leur artiste avant de le faire.
  const artistId = searchParams.get("artist");
  if (artistId) {
    if (!mongoose.Types.ObjectId.isValid(artistId)) throw new ApiError("Identifiant d'artiste invalide.");
    const titres = await Song.find({ artist: artistId })
      .select("title coverUrl genre status univers universSource releaseDate")
      .sort({ releaseDate: -1 })
      .limit(200)
      .lean();
    return NextResponse.json({
      titres: titres.map((t) => ({
        _id: String(t._id),
        title: t.title,
        coverUrl: t.coverUrl ?? "",
        genre: t.genre ?? "",
        status: t.status,
        univers: (t.univers ?? "general") as Univers,
        source: t.universSource ?? "artiste",
        // Ce que le lexique dirait de ce titre pris seul : utile pour
        // repérer le morceau de gospel isolé chez un artiste général.
        detecte: detecterUnivers({ titre: t.title, genre: t.genre }).univers as Univers,
      })),
    });
  }

  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 80);
  const universFiltre = searchParams.get("univers");
  const sourceFiltre = searchParams.get("source");

  const filtre: Record<string, unknown> = {};
  if (estUnivers(universFiltre)) filtre.univers = universFiltre;
  if (sourceFiltre === "auto" || sourceFiltre === "admin") filtre.universSource = sourceFiltre;
  if (q) filtre.stageName = { $regex: escapeRegex(q), $options: "i" };

  const [artistes, total, statsArtistes, statsTitres, ia] = await Promise.all([
    Artist.find(filtre)
      .select("stageName coverUrl verified genres univers universSource universMotif totalPlays")
      .sort({ totalPlays: -1, stageName: 1 })
      .skip((page - 1) * PAR_PAGE)
      .limit(PAR_PAGE)
      .lean(),
    Artist.countDocuments(filtre),
    Artist.aggregate<{ _id: string; total: number }>([{ $group: { _id: "$univers", total: { $sum: 1 } } }]),
    Song.aggregate<{ _id: string; total: number }>([
      { $match: { status: "published" } },
      { $group: { _id: "$univers", total: { $sum: 1 } } },
    ]),
    etatIA("univers"),
  ]);

  // Le nombre de titres par artiste, en une agrégation plutôt qu'un
  // comptage par ligne : la page en affiche vingt-cinq à la fois.
  const ids = artistes.map((a) => a._id);
  const titresParArtiste = await Song.aggregate<{ _id: mongoose.Types.ObjectId; total: number; chretiens: number }>([
    { $match: { artist: { $in: ids } } },
    {
      $group: {
        _id: "$artist",
        total: { $sum: 1 },
        chretiens: { $sum: { $cond: [{ $eq: ["$univers", "christian"] }, 1, 0] } },
      },
    },
  ]);
  const comptes = new Map(titresParArtiste.map((t) => [String(t._id), t]));

  const parUnivers = (lignes: { _id: string; total: number }[]) =>
    Object.fromEntries(
      UNIVERS.map((u) => [u, lignes.find((l) => l._id === u)?.total ?? 0])
    ) as Record<Univers, number>;

  return NextResponse.json({
    page,
    total,
    hasMore: page * PAR_PAGE < total,
    univers: UNIVERS.map((u) => ({ id: u, ...UNIVERS_INFO[u] })),
    stats: { artistes: parUnivers(statsArtistes), titres: parUnivers(statsTitres) },
    iaDisponible: ia.disponible,
    artistes: artistes.map((a) => {
      const compte = comptes.get(String(a._id));
      return {
        _id: String(a._id),
        stageName: a.stageName,
        coverUrl: a.coverUrl ?? "",
        verified: !!a.verified,
        genres: a.genres ?? [],
        univers: (a.univers ?? "general") as Univers,
        source: a.universSource ?? "auto",
        motif: a.universMotif ?? "",
        titres: compte?.total ?? 0,
        // Combien de ses titres sont rangés côté évangélique : révèle
        // d'un coup d'œil les artistes à cheval, qui sont ceux qu'un
        // admin doit regarder.
        titresChretiens: compte?.chretiens ?? 0,
      };
    }),
  });
});

export const PATCH = withApiErrors(async (req: Request) => {
  await requireAdmin(req);

  const { type, id, univers } = (await req.json()) as {
    type?: unknown;
    id?: unknown;
    univers?: unknown;
  };

  if (type !== "artist" && type !== "song") throw new ApiError("Type inconnu : artist ou song attendu.");
  if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError("Identifiant invalide.");
  }
  if (!estUnivers(univers)) throw new ApiError("Univers inconnu.");

  await connectDB();

  if (type === "artist") {
    const artiste = await Artist.findById(id).select("stageName");
    if (!artiste) throw new ApiError("Artiste introuvable.", 404);
    const titres = await classerArtiste(id, {
      univers,
      source: "admin",
      motif: "Classement décidé en administration.",
    });
    return NextResponse.json({
      univers,
      titresDeplaces: titres,
      message: `${artiste.stageName} passe dans l'univers ${UNIVERS_INFO[univers].label.toLowerCase()}, avec ${titres} titre(s).`,
    });
  }

  const titre = await Song.findById(id).select("title");
  if (!titre) throw new ApiError("Titre introuvable.", 404);
  await classerTitre(id, { univers, source: "admin" });
  return NextResponse.json({
    univers,
    titresDeplaces: 1,
    message: `« ${titre.title} » passe dans l'univers ${UNIVERS_INFO[univers].label.toLowerCase()}. Il ne suivra plus son artiste.`,
  });
});

export const POST = withApiErrors(async (req: Request) => {
  const { user } = await requireAdmin(req);
  const { avecIA } = (await req.json().catch(() => ({}))) as { avecIA?: unknown };

  const resultat = await classerCatalogue({ avecIA: avecIA === true, compte: user.id });

  return NextResponse.json({
    ...resultat,
    message:
      resultat.artistes === 0 && resultat.titres === 0
        ? "Aucun changement : le catalogue était déjà classé."
        : `${resultat.artistes} artiste(s) et ${resultat.titres} titre(s) reclassés.`,
  });
});
