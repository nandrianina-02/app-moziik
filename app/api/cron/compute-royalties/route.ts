import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Play from "@/models/Play";
import Royalty from "@/models/Royalty";
import Artist from "@/models/Artist";
import { getSiteConfig } from "@/lib/siteConfig";
import { notifyEach } from "@/lib/notify";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const dynamic = "force-dynamic";

/**
 * Regroupe les écoutes complètes non encore payées par artiste, écrit un
 * relevé au tarif courant, et marque ces écoutes pour ne pas les
 * recompter.
 *
 * À appeler une fois par jour avec `Authorization: Bearer <CRON_SECRET>`.
 *
 * ---
 *
 * **Réserver d'abord, calculer ensuite.**
 *
 * Le passage commence par marquer en une seule écriture toutes les écoutes
 * qu'il va traiter, avec son propre identifiant. Deux exécutions
 * simultanées ne peuvent donc pas payer les mêmes écoutes : la seconde
 * n'en réserve aucune et repart à vide.
 *
 * Ce n'est pas théorique — c'est exactement ce qui se produit quand
 * l'ordonnanceur abandonne sur un délai d'attente et relance : la première
 * exécution continue côté serveur, et sans réservation la relance aurait
 * doublé les droits de chaque artiste.
 */

/**
 * Nombre d'écoutes qu'un seul passage traite au plus.
 *
 * Le regroupement se fait en une agrégation, donc en un aller-retour : le
 * plafond ne sert pas à tenir dans le temps imparti mais à borner la
 * mémoire d'un rattrapage après une longue panne. Le reliquat part au
 * passage suivant, et la réponse dit combien il en reste.
 */
const MAX_ECOUTES_PAR_PASSAGE = 100_000;

export const POST = withApiErrors(async (req: Request) => {
  if (!process.env.CRON_SECRET) {
    // Échec bruyant plutôt que silencieux : sans cette variable, la
    // comparaison ci-dessous rejetterait TOUJOURS les appels valides
    // sans jamais expliquer pourquoi ("Bearer undefined" ne matche
    // jamais), ce qui masquerait un oubli de configuration en prod.
    throw new ApiError("CRON_SECRET n'est pas configuré côté serveur.", 500);
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    throw new ApiError("Non autorisé.", 401);
  }

  await connectDB();
  const config = await getSiteConfig();
  const periodEnd = new Date();
  const run = new Types.ObjectId();

  // Pas de borne basse sur playedAt : `monetized: false` dit déjà « pas
  // encore traité ». Borner à « depuis 24 h » ferait perdre en silence les
  // écoutes plus anciennes si un passage a été manqué.
  const aTraiter = {
    completed: true,
    monetized: false,
    playedAt: { $lte: periodEnd },
  } as const;

  const enAttente = await Play.countDocuments(aTraiter);
  if (enAttente === 0) {
    return NextResponse.json({ royaltiesCreated: 0, artistsProcessed: 0, playsProcessed: 0, reste: 0 });
  }

  // La réservation. `$lte` sur une borne d'horodatage plutôt qu'une liste
  // d'identifiants : une seule écriture, quel que soit le volume.
  const borne =
    enAttente > MAX_ECOUTES_PAR_PASSAGE
      ? (
          await Play.find(aTraiter)
            .sort({ playedAt: 1 })
            .skip(MAX_ECOUTES_PAR_PASSAGE - 1)
            .limit(1)
            .select("playedAt")
            .lean()
        )[0]?.playedAt
      : periodEnd;

  const reservation = await Play.updateMany(
    { ...aTraiter, playedAt: { $lte: borne ?? periodEnd } },
    { $set: { monetized: true, monetizedRun: run } }
  );

  const reservees = reservation.modifiedCount ?? 0;
  if (reservees === 0) {
    // Un autre passage a tout pris entre le comptage et la réservation.
    return NextResponse.json({ royaltiesCreated: 0, artistsProcessed: 0, playsProcessed: 0, reste: 0 });
  }

  try {
    // Une agrégation, un aller-retour. La version précédente parcourait un
    // curseur en peuplant `song` document par document : autant de
    // requêtes que d'écoutes, ce qui dépassait le délai d'attente de
    // l'ordonnanceur dès que quelques milliers d'écoutes s'accumulaient.
    const parArtiste = await Play.aggregate<{
      _id: Types.ObjectId;
      count: number;
      earliest: Date;
    }>([
      { $match: { monetizedRun: run } },
      {
        $lookup: {
          from: "songs",
          localField: "song",
          foreignField: "_id",
          as: "titre",
          pipeline: [{ $project: { artist: 1 } }],
        },
      },
      { $unwind: "$titre" },
      { $group: { _id: "$titre.artist", count: { $sum: 1 }, earliest: { $min: "$playedAt" } } },
    ]);

    if (parArtiste.length > 0) {
      await Royalty.insertMany(
        parArtiste.map((ligne) => ({
          artist: ligne._id,
          periodStart: ligne.earliest,
          periodEnd,
          eligiblePlays: ligne.count,
          amountUSD: Number((ligne.count * config.payPerListenRateUSD).toFixed(4)),
          run,
        }))
      );

      // Les comptes à prévenir, en une requête plutôt qu'une par artiste.
      const artistes = await Artist.find({ _id: { $in: parArtiste.map((l) => l._id) } })
        .select("user")
        .lean();
      const compteParArtiste = new Map(artistes.map((a) => [a._id.toString(), a.user.toString()]));

      // Une seule écriture pour toutes les notifications : le montant
      // diffère d'un artiste à l'autre, mais pas la requête.
      await notifyEach(
        parArtiste.flatMap((ligne) => {
          const compte = compteParArtiste.get(ligne._id.toString());
          if (!compte) return [];
          const montant = Number((ligne.count * config.payPerListenRateUSD).toFixed(4));
          return [
            {
              recipient: compte,
              type: "payment" as const,
              title: "Nouveau relevé de revenus",
              message: `${ligne.count} écoute(s) comptabilisée(s), soit ${montant.toFixed(2)} $.`,
              link: "/artiste/revenus",
            },
          ];
        })
      );
    }

    // Les écoutes dont le titre a disparu restent marquées : sans artiste,
    // elles ne seront jamais payables, et les laisser en attente les
    // ferait rebalayer à chaque passage jusqu'à la fin des temps.
    const paye = parArtiste.reduce((total, ligne) => total + ligne.count, 0);

    return NextResponse.json({
      royaltiesCreated: parArtiste.length,
      artistsProcessed: parArtiste.length,
      playsProcessed: paye,
      playsSansTitre: reservees - paye,
      reste: Math.max(0, enAttente - reservees),
    });
  } catch (err) {
    // La réservation est annulée : mieux vaut recompter au passage suivant
    // que de laisser des écoutes marquées payées sans relevé en face.
    await Play.updateMany(
      { monetizedRun: run },
      { $set: { monetized: false }, $unset: { monetizedRun: "" } }
    );
    throw err;
  }
});

/**
 * Durée maximale d'exécution.
 *
 * Le travail tient désormais en quelques allers-retours quel que soit le
 * volume — un comptage, une réservation, une agrégation, deux écritures.
 * Ce plafond n'est plus qu'un garde-fou : c'est le délai d'attente de
 * l'ordonnanceur, souvent 30 secondes, qui contraint réellement.
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
