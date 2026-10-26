import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Play from "@/models/Play";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";
import { getSiteConfig } from "@/lib/siteConfig";

/**
 * Le bilan de l'année du compte connecté : ce qu'il a écouté, le plus
 * écouté, et quand.
 *
 * Comme l'historique d'activité, aucun paramètre ne désigne un
 * utilisateur : l'identité vient de la session. Tout est lu sur la
 * collection des écoutes, la seule source ; un chiffre qui n'a pas été
 * enregistré ne s'invente pas.
 */

const TOP = 5;

export const GET = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);
  await connectDB();

  const config = await getSiteConfig();
  const timezone = config.timezone || "UTC";

  const anneeCourante = new Date().getUTCFullYear();
  const demande = Number(new URL(req.url).searchParams.get("annee"));
  const annee = Number.isInteger(demande) && demande > 0 ? demande : anneeCourante;
  if (annee < 2020 || annee > anneeCourante) throw new ApiError("Année invalide.", 400);

  // Bornes en UTC, à quelques heures près du fuseau du site : sans effet
  // sur un bilan qui porte sur une année entière.
  const debut = new Date(Date.UTC(annee, 0, 1));
  const fin = new Date(Date.UTC(annee + 1, 0, 1));
  const surLAnnee = { user: new Types.ObjectId(authUser.id), playedAt: { $gte: debut, $lt: fin } };

  const avecTitre = [
    { $lookup: { from: "songs", localField: "song", foreignField: "_id", as: "titre" } },
    { $unwind: "$titre" },
  ];

  const [resume, parTitre, parArtiste, parGenre, parMois, jours, premiere] = await Promise.all([
    Play.aggregate([
      { $match: surLAnnee },
      {
        $group: {
          _id: null,
          ecoutes: { $sum: 1 },
          secondes: { $sum: "$secondsListened" },
          titres: { $addToSet: "$song" },
        },
      },
      { $project: { _id: 0, ecoutes: 1, secondes: 1, titresDifferents: { $size: "$titres" } } },
    ]),
    Play.aggregate([
      { $match: surLAnnee },
      { $group: { _id: "$song", ecoutes: { $sum: 1 } } },
      { $sort: { ecoutes: -1 } },
      { $limit: TOP },
      { $lookup: { from: "songs", localField: "_id", foreignField: "_id", as: "titre" } },
      { $unwind: "$titre" },
      { $lookup: { from: "artists", localField: "titre.artist", foreignField: "_id", as: "artiste" } },
      {
        $project: {
          title: "$titre.title",
          coverUrl: "$titre.coverUrl",
          artist: { _id: { $first: "$artiste._id" }, stageName: { $first: "$artiste.stageName" } },
          ecoutes: 1,
        },
      },
    ]),
    Play.aggregate([
      { $match: surLAnnee },
      ...avecTitre,
      { $group: { _id: "$titre.artist", ecoutes: { $sum: 1 } } },
      { $sort: { ecoutes: -1 } },
      { $lookup: { from: "artists", localField: "_id", foreignField: "_id", as: "artiste" } },
      { $unwind: "$artiste" },
      // Le nombre d'artistes différents se compte avant la coupe du palmarès.
      {
        $facet: {
          top: [{ $limit: TOP }, { $project: { stageName: "$artiste.stageName", coverUrl: "$artiste.coverUrl", ecoutes: 1 } }],
          total: [{ $count: "n" }],
        },
      },
    ]),
    Play.aggregate([
      { $match: surLAnnee },
      ...avecTitre,
      { $match: { "titre.genre": { $nin: [null, ""] } } },
      { $group: { _id: "$titre.genre", ecoutes: { $sum: 1 } } },
      { $sort: { ecoutes: -1 } },
      { $limit: 3 },
    ]),
    Play.aggregate([
      { $match: surLAnnee },
      { $group: { _id: { $month: { date: "$playedAt", timezone } }, ecoutes: { $sum: 1 } } },
    ]),
    Play.aggregate([
      { $match: surLAnnee },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$playedAt", timezone } } } },
      { $count: "n" },
    ]),
    Play.aggregate([
      { $match: surLAnnee },
      { $sort: { playedAt: 1 } },
      { $limit: 1 },
      { $lookup: { from: "songs", localField: "song", foreignField: "_id", as: "titre" } },
      { $unwind: "$titre" },
      { $project: { _id: "$titre._id", title: "$titre.title", coverUrl: "$titre.coverUrl", date: "$playedAt" } },
    ]),
  ]);

  const r = resume[0] ?? { ecoutes: 0, secondes: 0, titresDifferents: 0 };
  const mois = Array.from({ length: 12 }, (_, i) => parMois.find((l) => l._id === i + 1)?.ecoutes ?? 0);
  const artistes = parArtiste[0] ?? { top: [], total: [] };

  return NextResponse.json(
    {
      annee,
      ecoutes: r.ecoutes,
      minutes: Math.round(r.secondes / 60),
      titresDifferents: r.titresDifferents,
      artistesDifferents: artistes.total[0]?.n ?? 0,
      joursActifs: jours[0]?.n ?? 0,
      topTitres: parTitre,
      topArtistes: artistes.top,
      topGenres: parGenre.map((l) => ({ genre: l._id, ecoutes: l.ecoutes })),
      parMois: mois,
      premiereEcoute: premiere[0] ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});
