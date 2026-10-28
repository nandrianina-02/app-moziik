import type { PlayableSong } from "@/context/PlayerProvider";

type ArtisteCourt = { _id?: string; stageName: string; verified?: boolean } | null;

/**
 * Les titres publiés d'un album, pour le lancer depuis sa carte. La route
 * ne peuple pas l'artiste de chaque titre : celui de l'album le remplace.
 */
export async function titresDeLAlbum(id: string, artiste: ArtisteCourt): Promise<PlayableSong[]> {
  const res = await fetch(`/api/albums/${id}`);
  if (!res.ok) throw new Error();
  const { album } = (await res.json()) as { album: { songs: (PlayableSong & { artist: unknown })[] } };
  return album.songs.map((t) => ({
    ...t,
    artist:
      t.artist && typeof t.artist === "object"
        ? (t.artist as PlayableSong["artist"])
        : artiste?._id
          ? { _id: artiste._id, stageName: artiste.stageName, verified: artiste.verified }
          : null,
  }));
}

/** Les titres d'une playlist, pour la lancer depuis sa carte. */
export async function titresDeLaPlaylist(id: string): Promise<PlayableSong[]> {
  const res = await fetch(`/api/playlists/${id}`);
  if (!res.ok) throw new Error();
  const { playlist } = (await res.json()) as { playlist: { songs: PlayableSong[] } };
  return playlist.songs ?? [];
}
