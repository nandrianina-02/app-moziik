import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import Artist from "@/models/Artist";
import { notify } from "@/lib/notify";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, createSongSchema } from "@/lib/validation";

export const GET = withApiErrors(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const genre = searchParams.get("genre");
  const artistId = searchParams.get("artist");
  const limit = Number(searchParams.get("limit") ?? 30);
  const sort = searchParams.get("sort"); // "popular" | par défaut : plus récents d'abord
  // Pagination optionnelle pour le scroll infini : absente, le
  // comportement est strictement identique à avant (page 1 implicite,
  // pas de hasMore dans la réponse ne gêne pas les appelants existants
  // qui l'ignorent déjà).
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));

  await connectDB();
  const query: Record<string, unknown> = { status: "published" };
  if (genre) query.genre = genre;
  if (artistId) query.artist = artistId;

  const [songs, total] = await Promise.all([
    Song.find(query)
      .populate("artist", "stageName verified")
      .populate("featuring.artist", "stageName verified")
      .sort(sort === "popular" ? { playsCount: -1 } : { releaseDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Song.countDocuments(query),
  ]);

  return NextResponse.json({ songs, page, hasMore: page * limit < total, total });
});

export const POST = withApiErrors(async (req: Request) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new ApiError("Non authentifié.", 401);
  if (session.user.role !== "artist" && session.user.role !== "admin") {
    throw new ApiError("Seuls les artistes peuvent publier un son.", 403);
  }

  const {
    title,
    audioUrl,
    coverUrl,
    duration,
    genre,
    albumId,
    releaseDate,
    explicit,
    lyrics,
    featuringIds,
    artistId,
    description,
    tags,
    language,
    composer,
    producer,
    bpm,
    musicalKey,
    isrc,
    copyright,
    saveAsDraft,
  } = parseOrThrow(createSongSchema, await req.json());

  await connectDB();

  let artistProfile;
  if (session.user.role === "admin") {
    // Un admin n'a pas forcément de profil Artist : il doit préciser
    // pour quel artiste il publie.
    if (!artistId) throw new ApiError("artistId requis pour qu'un admin publie un son.");
    artistProfile = await Artist.findById(artistId);
    if (!artistProfile) throw new ApiError("Artiste introuvable.", 404);
  } else {
    artistProfile = await Artist.findOne({ user: session.user.id });
    if (!artistProfile) throw new ApiError("Profil artiste introuvable.", 404);
  }

  const release = new Date(releaseDate);
  // Un son soumis par un artiste attend la validation d'un admin avant
  // d'être publié ou planifié. Un admin peut publier directement, ou
  // enregistrer en brouillon via saveAsDraft (symétrique avec PATCH).
  const status =
    session.user.role === "admin"
      ? saveAsDraft
        ? "draft"
        : release <= new Date()
          ? "published"
          : "scheduled"
      : "draft";

  const featuring = Array.isArray(featuringIds)
    ? featuringIds
        .filter((id: string) => id !== artistProfile._id.toString())
        .map((id: string) => ({ artist: id, confirmed: false }))
    : [];

  const song = await Song.create({
    title,
    artist: artistProfile._id,
    featuring,
    album: albumId || undefined,
    audioUrl,
    coverUrl,
    duration,
    genre,
    lyrics,
    description,
    tags,
    language,
    composer,
    producer,
    bpm,
    musicalKey,
    isrc,
    copyright,
    explicit: !!explicit,
    status,
    releaseDate: release,
    publishedBy: session.user.id,
  });

  for (const credit of featuring) {
    const featuredArtist = await Artist.findById(credit.artist);
    if (featuredArtist) {
      await notify({
        recipient: featuredArtist.user.toString(),
        type: "system",
        title: "Tu es crédité en featuring",
        message: `${artistProfile.stageName} t'a ajouté en featuring sur "${title}".`,
        link: `/son/${song._id}`,
      });
    }
  }

  return NextResponse.json({ song }, { status: 201 });
});
