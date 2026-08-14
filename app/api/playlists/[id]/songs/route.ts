import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Playlist from "@/models/Playlist";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, playlistSongSchema } from "@/lib/validation";
import { requireAuthUser } from "@/lib/mobileAuth";

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
    const authUser = await requireAuthUser(req);

    const { songId } = parseOrThrow(playlistSongSchema, await req.json());

    await connectDB();
    const playlist = await loadOwnedPlaylist(params.id, authUser.id);

    if (!playlist.songs.some((s) => s.toString() === songId)) {
      playlist.songs.push(new Types.ObjectId(songId));
      await playlist.save();
    }

    return NextResponse.json({ playlist });
  }
);

export const DELETE = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    const authUser = await requireAuthUser(req);

    const { songId } = parseOrThrow(playlistSongSchema, await req.json());

    await connectDB();
    const playlist = await loadOwnedPlaylist(params.id, authUser.id);

    playlist.songs = playlist.songs.filter((s) => s.toString() !== songId) as typeof playlist.songs;
    await playlist.save();

    return NextResponse.json({ playlist });
  }
);
