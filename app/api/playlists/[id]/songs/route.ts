import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Playlist from "@/models/Playlist";
import { ApiError, withApiErrors } from "@/lib/apiError";

async function loadOwnedPlaylist(id: string, userId: string) {
  const playlist = await Playlist.findById(id);
  if (!playlist) throw new ApiError("Playlist introuvable.", 404);
  if (playlist.owner.toString() !== userId) {
    throw new ApiError("Tu ne peux modifier que tes propres playlists.", 403);
  }
  return playlist;
}

export const POST = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new ApiError("Non authentifié.", 401);

    const { songId } = await req.json();
    if (!songId) throw new ApiError("songId requis.");

    await connectDB();
    const playlist = await loadOwnedPlaylist(params.id, session.user.id);

    if (!playlist.songs.some((s) => s.toString() === songId)) {
      playlist.songs.push(songId);
      await playlist.save();
    }

    return NextResponse.json({ playlist });
  }
);

export const DELETE = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new ApiError("Non authentifié.", 401);

    const { songId } = await req.json();
    if (!songId) throw new ApiError("songId requis.");

    await connectDB();
    const playlist = await loadOwnedPlaylist(params.id, session.user.id);

    playlist.songs = playlist.songs.filter((s) => s.toString() !== songId) as typeof playlist.songs;
    await playlist.save();

    return NextResponse.json({ playlist });
  }
);
