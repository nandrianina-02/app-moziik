import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Play from "@/models/Play";
import Royalty from "@/models/Royalty";
import Artist from "@/models/Artist";
import { getSiteConfig } from "@/lib/siteConfig";
import { notify } from "@/lib/notify";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const dynamic = "force-dynamic";

/**
 * À appeler périodiquement (ex: 1 fois par jour via un cron externe).
 * Regroupe les écoutes complètes non encore monétisées par artiste,
 * crée un relevé Royalty au tarif courant (SiteConfig.payPerListenRateUSD),
 * puis marque ces écoutes comme "monetized" pour ne pas les recompter.
 */
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

  // Pas de borne basse sur playedAt : `monetized: false` marque déjà "pas
  // encore traité par un run précédent" — borner à "depuis 24h" en plus
  // ferait perdre silencieusement les écoutes plus anciennes si un cron a
  // été manqué (ex: panne d'un jour). periodStart est donc calculé PAR
  // ARTISTE comme la date de la plus ancienne écoute réellement traitée
  // dans ce lot, pour que le relevé reflète la période couverte pour de
  // vrai plutôt qu'une fenêtre fixe potentiellement fausse.
  //
  // .cursor() : on itère sans charger tout le lot en mémoire d'un coup —
  // un run manqué pendant plusieurs jours peut accumuler un volume élevé
  // d'écoutes non monétisées.
  const cursor = Play.find({
    completed: true,
    monetized: false,
    playedAt: { $lte: periodEnd },
  })
    .populate({ path: "song", select: "artist" })
    .cursor();

  const playsByArtist = new Map<
    string,
    { count: number; playIds: string[]; earliestPlayedAt: Date }
  >();
  for await (const play of cursor) {
    const song = play.song as unknown as { artist: { toString: () => string } } | null;
    if (!song?.artist) continue;
    const artistId = song.artist.toString();
    const entry = playsByArtist.get(artistId) ?? { count: 0, playIds: [], earliestPlayedAt: play.playedAt };
    entry.count += 1;
    entry.playIds.push(play._id.toString());
    if (play.playedAt < entry.earliestPlayedAt) entry.earliestPlayedAt = play.playedAt;
    playsByArtist.set(artistId, entry);
  }

  // Les identifiants à marquer "monetized" peuvent être nombreux (tous
  // artistes confondus) : on les met à jour par lots plutôt qu'en un seul
  // $in géant, qui pourrait dépasser la taille max d'une requête MongoDB.
  const UPDATE_BATCH_SIZE = 1000;
  async function markMonetized(playIds: string[]) {
    for (let i = 0; i < playIds.length; i += UPDATE_BATCH_SIZE) {
      const batch = playIds.slice(i, i + UPDATE_BATCH_SIZE);
      await Play.updateMany({ _id: { $in: batch } }, { monetized: true });
    }
  }

  let royaltiesCreated = 0;
  for (const [artistId, { count, playIds, earliestPlayedAt }] of playsByArtist) {
    const amountUSD = Number((count * config.payPerListenRateUSD).toFixed(4));

    await Royalty.create({
      artist: artistId,
      periodStart: earliestPlayedAt,
      periodEnd,
      eligiblePlays: count,
      amountUSD,
    });

    await markMonetized(playIds);
    royaltiesCreated += 1;

    const artist = await Artist.findById(artistId);
    if (artist) {
      await notify({
        recipient: artist.user.toString(),
        type: "payment",
        title: "Nouveau relevé de revenus",
        message: `${count} écoute(s) comptabilisée(s), soit ${amountUSD.toFixed(2)} $.`,
        link: "/artiste/revenus",
      });
    }
  }

  return NextResponse.json({ royaltiesCreated, artistsProcessed: playsByArtist.size });
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
