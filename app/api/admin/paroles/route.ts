import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import { withApiErrors } from "@/lib/apiError";
import { requireAdmin } from "@/lib/requireAdmin";

/**
 * L'état des paroles du catalogue, pour l'administration : quels titres
 * n'en ont pas, lesquels n'ont que le texte, lesquels défilent déjà en
 * rythme dans le lecteur.
 *
 * L'état se calcule en base sur le champ `lyrics` : un horodatage LRC
 * (`[01:23.45]`) suffit à classer un titre « synchronisé », comme le fait
 * `analyserParoles` côté lecteur. Les paroles elles-mêmes ne sont pas
 * renvoyées : l'atelier les relit titre par titre.
 */

const HORODATAGE = /\[\d{1,3}:\d{1,2}([.:]\d{1,3})?\]/;
const PAR_PAGE = 30;
const ETATS = ["aucune", "texte", "synchro"] as const;
type Etat = (typeof ETATS)[number];

const etatCalcule = {
  $switch: {
    branches: [
      { case: { $lte: [{ $strLenCP: { $trim: { input: { $ifNull: ["$lyrics", ""] } } } }, 0] }, then: "aucune" },
      { case: { $regexMatch: { input: "$lyrics", regex: HORODATAGE } }, then: "synchro" },
    ],
    default: "texte",
  },
};

function echapper(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin(req);
  await connectDB();

  const params = new URL(req.url).searchParams;
  const etatDemande = params.get("etat");
  const etat: Etat | null = ETATS.includes(etatDemande as Etat) ? (etatDemande as Etat) : null;
  const recherche = (params.get("q") ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number(params.get("page")) || 1);

  // Les brouillons comptent aussi : c'est avant la publication qu'on cale les paroles.
  const filtre = recherche ? { title: { $regex: echapper(recherche), $options: "i" } } : {};

  const [resultat] = await Song.aggregate([
    { $match: filtre },
    { $addFields: { etat: etatCalcule, publie: { $eq: ["$status", "published"] } } },
    {
      $facet: {
        compteurs: [{ $group: { _id: "$etat", n: { $sum: 1 } } }],
        titres: [
          ...(etat ? [{ $match: { etat } }] : []),
          // Les titres publiés d'abord : ce sont ceux qu'on écoute aujourd'hui.
          { $sort: { publie: -1, playsCount: -1, _id: -1 } },
          { $skip: (page - 1) * PAR_PAGE },
          { $limit: PAR_PAGE + 1 },
          { $lookup: { from: "artists", localField: "artist", foreignField: "_id", as: "artiste" } },
          {
            $project: {
              title: 1,
              coverUrl: 1,
              status: 1,
              playsCount: 1,
              etat: 1,
              artist: { stageName: { $first: "$artiste.stageName" } },
            },
          },
        ],
      },
    },
  ]);

  const compteurs = { aucune: 0, texte: 0, synchro: 0 } as Record<Etat, number>;
  for (const ligne of resultat.compteurs as { _id: Etat; n: number }[]) compteurs[ligne._id] = ligne.n;
  const titres = resultat.titres as unknown[];

  return NextResponse.json(
    { compteurs, titres: titres.slice(0, PAR_PAGE), suite: titres.length > PAR_PAGE, page },
    { headers: { "Cache-Control": "no-store" } },
  );
});
