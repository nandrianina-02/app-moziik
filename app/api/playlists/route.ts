import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Playlist from "@/models/Playlist";
import { withApiErrors } from "@/lib/apiError";
import { parseOrThrow, createPlaylistSchema } from "@/lib/validation";
import { idsPublies } from "@/lib/publishedSongs";
import { getAuthUser, requireAuthUser } from "@/lib/mobileAuth";

export const GET = withApiErrors(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  let owner = searchParams.get("owner");
  const publicOnly = searchParams.get("public") === "true";

  if (owner === "me") {
    const authUser = await requireAuthUser(req);
    owner = authUser.id;
  }

  await connectDB();
  const query: Record<string, unknown> = {};
  if (owner) query.owner = owner;

  // Sans propriétaire, la requête ne portait aucun filtre : appelée à nu,
  // /api/playlists renvoyait TOUTES les playlists de la base, privées
  // comprises. Aucun écran ne l'appelle ainsi — tous passent `owner=me`
  // ou `public=true` — mais l'URL suffisait à énumérer les playlists
  // privées de tout le monde.
  //
  // La règle tient en une phrase : on ne voit le privé que chez soi.
  // Elle vaut aussi pour les brouillons de la curation hebdomadaire, qui
  // ne doivent pas s'afficher avant validation (lib/curation/).
  const authUser = owner ? await getAuthUser(req) : null;
  const chezSoi = Boolean(authUser && owner === authUser.id);
  if (publicOnly || !chezSoi) query.isPublic = true;

  const playlists = await Playlist.find(query).populate("owner", "name avatarUrl").sort({ createdAt: -1 });
  return NextResponse.json({ playlists });
});

export const POST = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);

  const { title, description, coverUrl, isPublic, songIds } = parseOrThrow(
    createPlaylistSchema,
    await req.json()
  );

  await connectDB();

  // Les identifiants recus sont filtres sur ce qui existe et est publie :
  // une playlist creee avec son contenu ne doit pas pouvoir contenir un
  // brouillon d'artiste ou un identifiant invente.
  const songs = songIds?.length ? await idsPublies(songIds) : [];

  const playlist = await Playlist.create({
    title,
    description,
    coverUrl,
    isPublic,
    owner: authUser.id,
    songs,
  });

  return NextResponse.json({ playlist }, { status: 201 });
});
