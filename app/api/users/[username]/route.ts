import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Artist from "@/models/Artist";
import Badge from "@/models/Badge";
import Playlist from "@/models/Playlist";
import { ApiError, withApiErrors } from "@/lib/apiError";

/**
 * Le profil public d'un membre.
 *
 * Public veut dire public : le nom, l'adresse du profil, la photo, la date
 * d'arrivée, les badges et les playlists que la personne a elle-même
 * publiées. Ni email, ni téléphone, ni ce qu'elle écoute, ni ce qu'elle a
 * aimé — rien qu'elle n'ait choisi de montrer.
 *
 * Un compte suspendu n'a pas de page : la modération l'a retiré de la
 * plateforme, l'exposer encore la contredirait.
 */
export const GET = withApiErrors(async (_req: Request, { params }: { params: { username: string } }) => {
  const username = params.username.toLowerCase();

  await connectDB();
  const user = await User.findOne({ username, suspended: { $ne: true } })
    .select("name username avatarUrl role badges createdAt")
    .lean();
  if (!user) throw new ApiError("Profil introuvable.", 404);

  const [badges, playlists, artist] = await Promise.all([
    Badge.find({ key: { $in: user.badges ?? [] } }).select("key label description icon category").lean(),
    Playlist.find({ owner: user._id, isPublic: true })
      .select("title coverUrl songs createdAt")
      .sort({ createdAt: -1 })
      .limit(24)
      .lean(),
    user.role === "artist"
      ? Artist.findOne({ user: user._id }).select("stageName verified coverUrl followers totalPlays").lean()
      : null,
  ]);

  return NextResponse.json({
    user: {
      name: user.name,
      username: user.username,
      avatarUrl: user.avatarUrl,
      role: user.role,
      createdAt: user.createdAt,
    },
    badges,
    playlists: playlists.map((p) => ({
      _id: p._id.toString(),
      title: p.title,
      coverUrl: p.coverUrl,
      songsCount: p.songs?.length ?? 0,
    })),
    // Un compte artiste garde sa vraie vitrine sur /artiste/<id> : on ne la
    // recopie pas, on y renvoie.
    artist: artist
      ? {
          _id: artist._id.toString(),
          stageName: artist.stageName,
          verified: artist.verified,
          coverUrl: artist.coverUrl,
          followersCount: artist.followers?.length ?? 0,
          totalPlays: artist.totalPlays ?? 0,
        }
      : null,
  });
});
