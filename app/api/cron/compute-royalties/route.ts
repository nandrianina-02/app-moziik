import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Play from "@/models/Play";
import Royalty from "@/models/Royalty";
import Artist from "@/models/Artist";
import { getSiteConfig } from "@/lib/siteConfig";
import { notify } from "@/lib/notify";
import { ApiError, withApiErrors } from "@/lib/apiError";

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
  const periodStart = new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000);

  const unmonetizedPlays = await Play.find({
    completed: true,
    monetized: false,
    playedAt: { $lte: periodEnd },
  }).populate({ path: "song", select: "artist" });

  const playsByArtist = new Map<string, { count: number; playIds: string[] }>();
  for (const play of unmonetizedPlays) {
    const song = play.song as unknown as { artist: { toString: () => string } } | null;
    if (!song?.artist) continue;
    const artistId = song.artist.toString();
    const entry = playsByArtist.get(artistId) ?? { count: 0, playIds: [] };
    entry.count += 1;
    entry.playIds.push(play._id.toString());
    playsByArtist.set(artistId, entry);
  }

  let royaltiesCreated = 0;
  for (const [artistId, { count, playIds }] of playsByArtist) {
    const amountUSD = Number((count * config.payPerListenRateUSD).toFixed(4));

    await Royalty.create({
      artist: artistId,
      periodStart,
      periodEnd,
      eligiblePlays: count,
      amountUSD,
    });

    await Play.updateMany({ _id: { $in: playIds } }, { monetized: true });
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
