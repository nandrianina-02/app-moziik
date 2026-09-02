import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Artist from "@/models/Artist";
import Song from "@/models/Song";
import Play from "@/models/Play";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";
import { getSiteConfig } from "@/lib/siteConfig";

/**
 * Les statistiques d'un artiste, sur son propre catalogue.
 *
 * Tout est agrégé côté base, sur la collection des écoutes : c'est la
 * seule source, celle qui alimente déjà les classements et le calcul des
 * droits. Aucun chiffre n'est estimé — ce qui n'a pas été enregistré ne
 * s'affiche pas.
 */

/** Fenêtre par défaut, et fenêtre de comparaison de même longueur. */
const JOURS_PAR_DEFAUT = 30;
const JOURS_MAX = 365;

/** Au-delà, un palmarès cesse d'être lisible. */
const TOP = 8;

export const GET = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);

  await connectDB();
  const artist = await Artist.findOne({ user: authUser.id }).select("_id followers totalPlays");
  if (!artist) throw new ApiError("Profil artiste introuvable.", 404);

  const demande = Number(new URL(req.url).searchParams.get("jours"));
  const jours = Math.min(JOURS_MAX, Math.max(1, Number.isFinite(demande) && demande > 0 ? demande : JOURS_PAR_DEFAUT));

  const config = await getSiteConfig();
  const timezone = config.timezone || "UTC";

  const maintenant = new Date();
  const debut = new Date(maintenant.getTime() - jours * 24 * 60 * 60 * 1000);
  // Fenêtre précédente, de même longueur : c'est ce qui donne son sens au
  // pourcentage d'évolution. Comparer à « tout l'historique » ferait
  // paraître en baisse un artiste dont le catalogue grandit.
  const debutPrecedent = new Date(debut.getTime() - jours * 24 * 60 * 60 * 1000);

  const titres = await Song.find({ artist: artist._id })
    .select("_id title coverUrl playsCount likesCount status")
    .lean();

  if (titres.length === 0) {
    return NextResponse.json({
      jours,
      catalogue: { titres: 0, publies: 0 },
      abonnes: artist.followers.length,
      resume: { ecoutes: 0, ecoutesPrecedentes: 0, auditeurs: 0, favoris: 0, tauxEcouteComplete: null },
      serie: [],
      topTitres: [],
      pays: [],
      appareils: [],
    });
  }

  const idsTitres = titres.map((t) => t._id as Types.ObjectId);
  const surLaPeriode = { song: { $in: idsTitres }, playedAt: { $gte: debut, $lte: maintenant } };

  const [serieBrute, resume, precedentes, parTitre, parPays, parAppareil] = await Promise.all([
    // Une ligne par jour, dans le fuseau du site : sinon une écoute de fin
    // de soirée bascule au lendemain selon l'endroit d'où l'on regarde.
    Play.aggregate<{ _id: string; n: number }>([
      { $match: surLaPeriode },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$playedAt", timezone } },
          n: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    Play.aggregate<{ ecoutes: number; auditeurs: string[]; completes: number }>([
      { $match: surLaPeriode },
      {
        $group: {
          _id: null,
          ecoutes: { $sum: 1 },
          // Les écoutes anonymes n'ont pas d'utilisateur : `$addToSet`
          // les regrouperait toutes sous un seul `null`, ce qui gonflerait
          // le compte d'un auditeur fantôme. Elles sont écartées du
          // décompte des auditeurs, pas de celui des écoutes.
          auditeurs: { $addToSet: "$user" },
          completes: { $sum: { $cond: ["$completed", 1, 0] } },
        },
      },
    ]),

    Play.countDocuments({
      song: { $in: idsTitres },
      playedAt: { $gte: debutPrecedent, $lt: debut },
    }),

    Play.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: surLaPeriode },
      { $group: { _id: "$song", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: TOP },
    ]),

    Play.aggregate<{ _id: string | null; n: number }>([
      { $match: { ...surLaPeriode, country: { $nin: [null, ""] } } },
      { $group: { _id: "$country", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: TOP },
    ]),

    Play.aggregate<{ _id: string | null; n: number }>([
      { $match: { ...surLaPeriode, device: { $nin: [null, ""] } } },
      { $group: { _id: "$device", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ]),
  ]);

  const total = resume[0]?.ecoutes ?? 0;
  const auditeurs = (resume[0]?.auditeurs ?? []).filter((u) => u != null).length;
  const completes = resume[0]?.completes ?? 0;

  // La série est complétée jour par jour : un jour sans écoute doit
  // apparaître à zéro, pas disparaître de la courbe.
  const parJour = new Map(serieBrute.map((l) => [l._id, l.n]));
  const cleJour = (d: Date) =>
    new Intl.DateTimeFormat("fr-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" })
      .format(d)
      .replace(/\//g, "-");

  const serie: { jour: string; ecoutes: number }[] = [];
  for (let i = jours - 1; i >= 0; i--) {
    const jour = cleJour(new Date(maintenant.getTime() - i * 24 * 60 * 60 * 1000));
    serie.push({ jour, ecoutes: parJour.get(jour) ?? 0 });
  }

  const titreParId = new Map(titres.map((t) => [t._id.toString(), t]));

  return NextResponse.json({
    jours,
    catalogue: {
      titres: titres.length,
      publies: titres.filter((t) => t.status === "published").length,
    },
    abonnes: artist.followers.length,
    resume: {
      ecoutes: total,
      ecoutesPrecedentes: precedentes,
      auditeurs,
      favoris: titres.reduce((somme, t) => somme + (t.likesCount ?? 0), 0),
      // Sans écoute sur la période, le taux n'existe pas — `null` plutôt
      // que `0 %`, qui se lirait comme « personne ne va au bout ».
      tauxEcouteComplete: total > 0 ? Math.round((completes / total) * 100) : null,
    },
    serie,
    topTitres: parTitre.map((ligne) => {
      const titre = titreParId.get(ligne._id.toString());
      return {
        _id: ligne._id,
        title: titre?.title ?? "Titre supprimé",
        coverUrl: titre?.coverUrl,
        ecoutes: ligne.n,
      };
    }),
    pays: parPays.map((l) => ({ code: l._id, ecoutes: l.n })),
    appareils: parAppareil.map((l) => ({ nom: l._id, ecoutes: l.n })),
  });
});
