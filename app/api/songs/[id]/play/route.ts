import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
    const session = await getServerSession(authOptions);

    await connectDB();
    const song = await Song.findById(params.id).select("duration playsCount");
    if (!song) throw new ApiError("Son introuvable.", 404);

    // Une écoute ne peut être marquée "complétée" (et donc monétisée) que
    // si le temps réellement écouté couvre au moins 80% de la durée du
    // titre. Empêche de spammer des requêtes `completed: true` avec
    // `secondsListened: 0` pour gonfler artificiellement les revenus.
    const isGenuinelyCompleted = completed && secondsListened >= song.duration * 0.8;

    // Sur Vercel, ces en-têtes de géolocalisation sont ajoutés
    // automatiquement en périphérie ; en local, ils seront absents.
    const headerList = headers();
    const country = headerList.get("x-vercel-ip-country") ?? undefined;
    const city = headerList.get("x-vercel-ip-city") ?? undefined;

    await Play.create({
      song: song._id,
      user: session?.user?.id,
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
