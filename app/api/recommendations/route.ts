import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Play from "@/models/Play";
import Song from "@/models/Song";
import { withApiErrors } from "@/lib/apiError";

/**
 * Recommandation par contenu : on regarde les genres des sons écoutés
 * par l'utilisateur ces 30 derniers jours, on pondère par fréquence,
 * puis on propose des sons publiés dans ces genres qu'il n'a pas
 * encore écoutés. Pas de ML ici — une base solide, remplaçable plus
 * tard par un moteur de recommandation dédié si besoin.
 */
export const GET = withApiErrors(async () => {
  const session = await getServerSession(authOptions);
  await connectDB();

  if (!session?.user) {
    // Utilisateur anonyme : on renvoie simplement les sons les plus populaires.
    const popular = await Song.find({ status: "published" })
      .populate("artist", "stageName verified")
      .sort({ playsCount: -1 })
      .limit(12);
    return NextResponse.json({ songs: popular, basis: "popular" });
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentPlays = await Play.find({ user: session.user.id, playedAt: { $gte: since } })
    .populate({ path: "song", select: "genre" });

  const genreCounts = new Map<string, number>();
  const listenedSongIds = new Set<string>();
  for (const play of recentPlays) {
    const song = play.song as unknown as { _id: { toString: () => string }; genre?: string } | null;
    if (!song) continue;
    listenedSongIds.add(song._id.toString());
    if (song.genre) genreCounts.set(song.genre, (genreCounts.get(song.genre) ?? 0) + 1);
  }

  const topGenres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => g);

  if (topGenres.length === 0) {
    const popular = await Song.find({ status: "published" })
      .populate("artist", "stageName verified")
      .sort({ playsCount: -1 })
      .limit(12);
    return NextResponse.json({ songs: popular, basis: "popular" });
  }

  const recommendations = await Song.find({
    status: "published",
    genre: { $in: topGenres },
    _id: { $nin: [...listenedSongIds] },
  })
    .populate("artist", "stageName verified")
    .sort({ playsCount: -1 })
    .limit(12);

  return NextResponse.json({ songs: recommendations, basis: "genres", genres: topGenres });
});
