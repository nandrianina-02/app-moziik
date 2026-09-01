import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/mobileAuth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Artist from "@/models/Artist";
import Song from "@/models/Song";
import Playlist from "@/models/Playlist";
import Badge from "@/models/Badge";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { reporterPhotoDeCompte } from "@/lib/artistPhoto";
import { parseOrThrow, patchMeProfileSchema } from "@/lib/validation";
import { assurerUsername } from "@/lib/username";

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

  // Les comptes antérieurs au nom d'utilisateur en reçoivent un ici, à leur
  // première lecture : pas de migration à lancer, et aucun compte ne reste
  // sans adresse publique une fois qu'il s'est montré.
  await assurerUsername(user);

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
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      phone: user.phone ?? "",
      role: user.role,
      verifiedArtist: user.verifiedArtist,
      emailVerified: user.emailVerified,
      suspended: user.suspended,
      hasPassword: Boolean(user.passwordHash),
      hasGoogleAccount: Boolean(user.googleId),
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt ?? null,
      preferences: user.preferences ?? {},
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

/**
 * Met à jour les informations du compte connecté : nom, photo, email,
 * téléphone et réglages régionaux. Seuls ces champs existent dans le
 * modèle — il n'y a toujours ni nom d'utilisateur ni bannière, et un champ
 * de formulaire sans colonne derrière ne serait qu'un décor.
 */
export const PATCH = withApiErrors(async (req: Request) => {
  const authUser = await getAuthUser(req);
  if (!authUser) throw new ApiError("Non authentifié.", 401);

  await connectDB();
  const user = await User.findById(authUser.id);
  if (!user) throw new ApiError("Utilisateur introuvable.", 404);

  const { name, username, avatarUrl, email, phone, preferences } = parseOrThrow(
    patchMeProfileSchema,
    await req.json().catch(() => ({}))
  );

  if (typeof name === "string") {
    user.name = name;
  }

  if (typeof username === "string" && username !== user.username) {
    // L'unicité est aussi garantie par un index : cette vérification sert
    // à répondre une phrase compréhensible plutôt qu'une erreur de base.
    const pris = await User.findOne({ username, _id: { $ne: user._id } }).select("_id");
    if (pris) throw new ApiError("Ce nom d'utilisateur est déjà pris.", 409);
    user.username = username;
  }

  if (typeof avatarUrl === "string") {
    user.avatarUrl = avatarUrl;
    // Un artiste qui n'a pas encore choisi de photo publique hérite de
    // celle de son compte. S'il en a déjà une, elle n'est pas touchée.
    await reporterPhotoDeCompte(user._id.toString(), avatarUrl);
  }

  if (typeof email === "string") {
    // Un compte lié à Google est retrouvé par email à chaque connexion
    // (voir lib/auth.ts) : le modifier ici créerait un compte en double
    // à la prochaine connexion Google plutôt que de renommer le sien.
    if (user.googleId) {
      throw new ApiError("Impossible de modifier l'email d'un compte lié à Google.", 400);
    }
    const normalized = email;
    if (normalized !== user.email) {
      const existing = await User.findOne({ email: normalized, _id: { $ne: user._id } });
      if (existing) throw new ApiError("Cette adresse email est déjà utilisée.", 409);
      user.email = normalized;
    }
  }

  // Une chaîne vide efface le numéro : c'est la seule façon de le retirer
  // depuis un formulaire.
  if (typeof phone === "string") {
    user.phone = phone.trim() || undefined;
  }

  if (preferences) {
    // Fusion et non remplacement : l'écran des préférences n'envoie que ce
    // qu'il affiche, et pourrait en oublier.
    user.preferences = { ...(user.preferences ?? {}), ...preferences };
  }

  await user.save();

  return NextResponse.json({
    user: {
      name: user.name,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      phone: user.phone ?? "",
      role: user.role,
      verifiedArtist: user.verifiedArtist,
      hasPassword: Boolean(user.passwordHash),
      hasGoogleAccount: Boolean(user.googleId),
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt ?? null,
      preferences: user.preferences ?? {},
    },
  });
});
