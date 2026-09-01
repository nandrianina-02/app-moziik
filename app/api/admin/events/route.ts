import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Event from "@/models/Event";
import { requireAdmin } from "@/lib/requireAdmin";
import { withApiErrors } from "@/lib/apiError";
import { escapeRegex } from "@/lib/regex";
import { EVENT_CATEGORIES } from "@/lib/evenements";

/**
 * Le poste de travail des évènements.
 *
 * Une seule requête sert la table paginée et les compteurs de l'en-tête :
 * les filtres de la table ne doivent pas changer les totaux, qui décrivent
 * toute la plateforme.
 */

const TAILLE_PAR_DEFAUT = 10;
const TAILLE_MAX = 100;

/**
 * Fenêtre pendant laquelle un évènement est réputé « en cours ».
 *
 * Identique à celle de l'affichage public (components/events/eventStatus.ts) :
 * deux définitions différentes du même mot donneraient deux comptes
 * différents pour le même évènement.
 */
const HEURES_EN_COURS = 6;

type Filtre = Record<string, unknown>;

export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin(req);

  const { searchParams } = new URL(req.url);
  const recherche = searchParams.get("q")?.trim() ?? "";
  const statut = searchParams.get("status") ?? "";
  const periode = searchParams.get("periode") ?? ""; // upcoming | live | past
  const categorie = searchParams.get("category") ?? "";
  const lieu = searchParams.get("lieu")?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const taille = Math.min(TAILLE_MAX, Math.max(1, Number(searchParams.get("limit")) || TAILLE_PAR_DEFAUT));

  await connectDB();

  const maintenant = new Date();
  const debutEnCours = new Date(maintenant.getTime() - HEURES_EN_COURS * 60 * 60 * 1000);

  const filtre: Filtre = {};
  if (statut) filtre.status = statut;
  if (categorie && (EVENT_CATEGORIES as string[]).includes(categorie)) filtre.category = categorie;

  if (periode === "upcoming") filtre.date = { $gt: maintenant };
  else if (periode === "live") filtre.date = { $lte: maintenant, $gte: debutEnCours };
  else if (periode === "past") filtre.date = { $lt: debutEnCours };

  if (recherche) {
    const motif = { $regex: escapeRegex(recherche), $options: "i" };
    filtre.$or = [{ title: motif }, { location: motif }, { city: motif }];
  }
  if (lieu) {
    // Le filtre de lieu s'applique à la ville comme à la salle : dans une
    // liste, « Paris » et « Accor Arena » désignent le même besoin.
    const motif = { $regex: escapeRegex(lieu), $options: "i" };
    filtre.$and = [{ $or: [{ city: motif }, { location: motif }] }];
  }

  const [events, total, parStatut, parPeriode, parCategorie, participants, nouveauxCeMois] =
    await Promise.all([
      Event.find(filtre)
        .select("-program -practicalInfo -inclusions -gallery -interested -tickets")
        .populate("artist", "stageName verified")
        .sort({ date: -1 })
        .skip((page - 1) * taille)
        .limit(taille),
      Event.countDocuments(filtre),
      Event.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
      Promise.all([
        Event.countDocuments({ date: { $gt: maintenant } }),
        Event.countDocuments({ date: { $lte: maintenant, $gte: debutEnCours } }),
        Event.countDocuments({ date: { $lt: debutEnCours } }),
      ]),
      Event.aggregate<{ _id: string | null; n: number }>([
        { $group: { _id: "$category", n: { $sum: 1 } } },
        { $sort: { n: -1 } },
      ]),
      Event.aggregate<{ total: number }>([
        { $group: { _id: null, total: { $sum: { $ifNull: ["$interestedCount", 0] } } } },
        { $project: { _id: 0, total: 1 } },
      ]),
      Event.countDocuments({
        createdAt: { $gte: new Date(maintenant.getFullYear(), maintenant.getMonth(), 1) },
      }),
    ]);

  const [upcoming, live, past] = parPeriode;
  const statuts = Object.fromEntries(parStatut.map((s) => [s._id, s.n]));

  return NextResponse.json({
    events,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / taille)),
    stats: {
      total: upcoming + live + past,
      upcoming,
      live,
      past,
      participants: participants[0]?.total ?? 0,
      nouveauxCeMois,
      pending: statuts.pending ?? 0,
      published: statuts.published ?? 0,
      rejected: statuts.rejected ?? 0,
      categories: parCategorie.map((c) => ({ categorie: c._id, n: c.n })),
    },
  });
});
