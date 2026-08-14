import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getAuthUser } from "@/lib/mobileAuth";
import { connectDB } from "@/lib/db";
import Play from "@/models/Play";
import Song from "@/models/Song";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { checkRateLimitByIp } from "@/lib/rateLimit";
import { parseOrThrow, songPlaySchema } from "@/lib/validation";

export const POST = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    // Les écoutes complètes alimentent directement le calcul des
    // royalties (voir /api/cron/compute-royalties) : sans limite, un
    // script pourrait gonfler artificiellement les revenus d'un artiste.
    // 60 écoutes / minute / IP reste large pour un usage normal (lecture
    // en continu d'une playlist) tout en freinant un script de spam.
    checkRateLimitByIp("song-play", { limit: 60, windowMs: 60 * 1000 });

    const { secondsListened, completed, device } = parseOrThrow(songPlaySchema, await req.json());
    const authUser = await getAuthUser(req);

    await connectDB();
    const song = await Song.findById(params.id).select("duration playsCount");
    if (!song) throw new ApiError("Son introuvable.", 404);

    // Une écoute ne peut être marquée "complétée" (et donc monétisée) que
    // si le temps réellement écouté couvre au moins 80% de la durée du
    // titre. Empêche de spammer des requêtes `completed: true` avec
    // `secondsListened: 0` pour gonfler artificiellement les revenus.
    let isGenuinelyCompleted = completed && secondsListened >= song.duration * 0.8;

    // Plafond anti-fraude : au-delà d'un nombre généreux d'écoutes
    // complètes du MÊME titre par le MÊME utilisateur en 24h, les écoutes
    // suivantes sont toujours enregistrées (historique, statistiques) mais
    // ne sont plus éligibles à la monétisation. `secondsListened` est
    // déclaré par le client, donc rejouable en boucle depuis un script
    // authentifié — le rate limit par IP ci-dessus ne suffit pas seul à
    // empêcher un utilisateur de gonfler ses propres revenus d'artiste sur
    // un titre qu'il aurait publié. 50 écoutes/jour du même titre reste
    // largement au-dessus d'un usage réel (même en boucle volontaire).
    const MAX_MONETIZABLE_PLAYS_PER_SONG_PER_DAY = 50;
    if (isGenuinelyCompleted && authUser?.id) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentCompletedCount = await Play.countDocuments({
        song: song._id,
        user: authUser.id,
        completed: true,
        playedAt: { $gte: since },
      });
      if (recentCompletedCount >= MAX_MONETIZABLE_PLAYS_PER_SONG_PER_DAY) {
        isGenuinelyCompleted = false;
      }
    }

    // Sur Vercel, ces en-têtes de géolocalisation sont ajoutés
    // automatiquement en périphérie ; en local, ils seront absents.
    const headerList = headers();
    const country = headerList.get("x-vercel-ip-country") ?? undefined;
    const city = headerList.get("x-vercel-ip-city") ?? undefined;

    await Play.create({
      song: song._id,
      user: authUser?.id,
      country,
      city,
      device,
      secondsListened,
      completed: isGenuinelyCompleted,
    });

    if (isGenuinelyCompleted) {
      // $inc atomique : évite la perte de comptage en cas d'écritures
      // concurrentes (lecture-modification-écriture précédente).
      await Song.updateOne({ _id: song._id }, { $inc: { playsCount: 1 } });
    }

    return NextResponse.json({ message: "Écoute enregistrée." }, { status: 201 });
  }
);
