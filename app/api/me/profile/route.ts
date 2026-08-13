import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/mobileAuth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Artist from "@/models/Artist";
import Song from "@/models/Song";
import Playlist from "@/models/Playlist";
import Badge from "@/models/Badge";
import { ApiError, withApiErrors } from "@/lib/apiError";

/**
 * Vue d'ensemble du profil pour la page "Mon compte" : combine les
 * compteurs réels (musiques aimées, albums enregistrés, playlists,
 * artistes suivis), les badges obtenus et — pour un compte artiste —
 * les statistiques de sa page artiste. Aucune donnée inventée : tout
 * champ absent (pas de profil artiste, aucun badge) est simplement
 * omis ou renvoyé à 0.
 */
export const GET = withApiErrors(async (req: Request) => {
  const authUser = await getAuthUser(req);
  if (!authUser) throw new ApiError("Non authentifié.", 401);

  await connectDB();

  const user = await User.findById(authUser.id);
  if (!user) throw new ApiError("Utilisateur introuvable.", 404);

  const [playlistsCount, followedArtistsCount, earnedBadges] = await Promise.all([
    Playlist.countDocuments({ owner: user._id }),
    Artist.countDocuments({ followers: user._id }),
    Badge.find({ key: { $in: user.badges } }).select("key label description icon category"),
  ]);

  let artist: {
    stageName: string;
    verified: boolean;
    coverUrl?: string;
    followersCount: number;
    totalPlays: number;
    songsCount: number;
  } | null = null;

  if (user.role === "artist") {
    const artistDoc = await Artist.findOne({ user: user._id });
    if (artistDoc) {
      const songsCount = await Song.countDocuments({ artist: artistDoc._id, status: "published" });
      artist = {
        stageName: artistDoc.stageName,
        verified: artistDoc.verified,
        coverUrl: artistDoc.coverUrl,
        followersCount: artistDoc.followers.length,
        totalPlays: artistDoc.totalPlays,
        songsCount,
      };
    }
  }

  return NextResponse.json({
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
      verifiedArtist: user.verifiedArtist,
      hasPassword: Boolean(user.passwordHash),
      hasGoogleAccount: Boolean(user.googleId),
      createdAt: user.createdAt,
    },
    stats: {
      likedSongsCount: user.likedSongs.length,
      savedAlbumsCount: user.savedAlbums.length,
      playlistsCount,
      followedArtistsCount,
    },
    badges: earnedBadges,
    artist,
  });
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Met à jour les informations de base du compte connecté (nom, photo,
 * email). Seuls les champs réellement présents dans le modèle User sont
 * modifiables ici — pas de nom d'utilisateur, bio, téléphone ou bannière :
 * ces champs n'existent pas dans le schéma actuel.
 */
export const PATCH = withApiErrors(async (req: Request) => {
  const authUser = await getAuthUser(req);
  if (!authUser) throw new ApiError("Non authentifié.", 401);

  await connectDB();
  const user = await User.findById(authUser.id);
  if (!user) throw new ApiError("Utilisateur introuvable.", 404);

  const body = await req.json().catch(() => ({}));
  const { name, avatarUrl, email } = body ?? {};

  if (typeof name === "string") {
    const trimmed = name.trim();
    if (!trimmed) throw new ApiError("Le nom ne peut pas être vide.", 400);
    if (trimmed.length > 80) throw new ApiError("Le nom est trop long (80 caractères max).", 400);
    user.name = trimmed;
  }

  if (typeof avatarUrl === "string" && avatarUrl.trim()) {
    user.avatarUrl = avatarUrl.trim();
  }

  if (typeof email === "string") {
    // Un compte lié à Google est retrouvé par email à chaque connexion
    // (voir lib/auth.ts) : le modifier ici créerait un compte en double
    // à la prochaine connexion Google plutôt que de renommer le sien.
    if (user.googleId) {
      throw new ApiError("Impossible de modifier l'email d'un compte lié à Google.", 400);
    }
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalized)) throw new ApiError("Adresse email invalide.", 400);
    if (normalized !== user.email) {
      const existing = await User.findOne({ email: normalized, _id: { $ne: user._id } });
      if (existing) throw new ApiError("Cette adresse email est déjà utilisée.", 409);
      user.email = normalized;
    }
  }

  await user.save();

  return NextResponse.json({
    user: {
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
      verifiedArtist: user.verifiedArtist,
      hasPassword: Boolean(user.passwordHash),
      hasGoogleAccount: Boolean(user.googleId),
      createdAt: user.createdAt,
    },
  });
});
