import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import Artist from "@/models/Artist";
import { notifyMany } from "@/lib/notify";
import { withApiErrors, ApiError } from "@/lib/apiError";

/**
 * À appeler périodiquement (ex: Vercel Cron toutes les 5 minutes) avec
 * l'en-tête Authorization: Bearer <CRON_SECRET>.
 * Publie les sons "scheduled" dont la releaseDate est passée, et
 * notifie les abonnés de l'artiste.
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
  const due = await Song.find({ status: "scheduled", releaseDate: { $lte: new Date() } });

  for (const song of due) {
    song.status = "published";
    await song.save();

    const artist = await Artist.findById(song.artist);
    if (artist && artist.followers.length > 0) {
      await notifyMany(
        artist.followers.map((f) => f.toString()),
        {
          type: "new_song",
          title: "Nouveau son disponible",
          message: `${artist.stageName} vient de publier "${song.title}".`,
          link: `/son/${song._id}`,
          imageUrl: song.coverUrl,
        }
      );
    }
  }

  return NextResponse.json({ published: due.length });
});
