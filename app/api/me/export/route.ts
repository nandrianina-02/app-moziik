import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Artist from "@/models/Artist";
import Song from "@/models/Song";
import Album from "@/models/Album";
import Playlist from "@/models/Playlist";
import Comment from "@/models/Comment";
import Subscription from "@/models/Subscription";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";

/**
 * Copie des données du compte, en JSON.
 *
 * Ce qui appartient à la personne, et rien d'autre : son profil, ce
 * qu'elle a aimé, ses playlists, ses commentaires, son abonnement, et son
 * catalogue si elle publie. Aucun secret n'y figure — ni empreinte de mot
 * de passe, ni jeton, ni identifiant de paiement.
 */
export const GET = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);

  await connectDB();
  const user = await User.findById(authUser.id)
    .select("-passwordHash -resetToken -resetTokenExpires -verificationToken -verificationTokenExpires")
    .populate("likedSongs", "title artist duration")
    .populate("savedAlbums", "title artist")
    .lean();
  if (!user) throw new ApiError("Compte introuvable.", 404);

  const [playlists, commentaires, abonnements, artist] = await Promise.all([
    Playlist.find({ owner: user._id }).select("title description isPublic songs createdAt").lean(),
    Comment.find({ user: user._id }).select("text song createdAt").lean(),
    Subscription.find({ user: user._id }).select("plan amount currency status startedAt currentPeriodEnd").lean(),
    Artist.findOne({ user: user._id }).select("stageName bio genres verified followers totalPlays").lean(),
  ]);

  let catalogue: unknown = null;
  if (artist) {
    const [morceaux, albums] = await Promise.all([
      Song.find({ artist: artist._id }).select("title status genre duration playsCount likesCount releaseDate").lean(),
      Album.find({ artist: artist._id }).select("title type releaseDate").lean(),
    ]);
    catalogue = { morceaux, albums };
  }

  const donnees = {
    exportedAt: new Date().toISOString(),
    compte: user,
    playlists,
    commentaires,
    abonnements,
    artiste: artist
      ? { ...artist, followersCount: artist.followers?.length ?? 0, followers: undefined, catalogue }
      : null,
  };

  // Téléchargement direct plutôt qu'affichage : c'est une archive, pas une
  // page. Le nom du fichier porte la date, pour s'y retrouver entre deux.
  return new NextResponse(JSON.stringify(donnees, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="moziik-mes-donnees-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
