import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import Album from "@/models/Album";
import Artist from "@/models/Artist";
import Playlist from "@/models/Playlist";
import Event from "@/models/Event";
import { requireAdmin } from "@/lib/requireAdmin";
import { withApiErrors } from "@/lib/apiError";
import { parseOrThrow, contentSearchQuerySchema } from "@/lib/validation";
import { escapeRegex } from "@/lib/regex";

/**
 * Recherche par titre/nom pour le sélecteur de contenu épinglé (hero et
 * autres sections manuelles), afin que l'admin choisisse un titre par
 * son nom plutôt que de devoir connaître son identifiant MongoDB.
 */
export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin();

  const { searchParams } = new URL(req.url);
  const { type, q } = parseOrThrow(contentSearchQuerySchema, {
    type: searchParams.get("type"),
    q: searchParams.get("q") ?? "",
  });

  await connectDB();
  const regex = q ? { $regex: escapeRegex(q), $options: "i" } : undefined;

  let results: { _id: string; title: string; coverUrl?: string }[] = [];

  switch (type) {
    case "song": {
      const songs = await Song.find(regex ? { title: regex } : {})
        .sort({ releaseDate: -1 })
        .limit(15)
        .select("title coverUrl");
      results = songs.map((s) => ({ _id: s._id.toString(), title: s.title, coverUrl: s.coverUrl }));
      break;
    }
    case "album": {
      const albums = await Album.find(regex ? { title: regex } : {})
        .sort({ releaseDate: -1 })
        .limit(15)
        .select("title coverUrl");
      results = albums.map((a) => ({ _id: a._id.toString(), title: a.title, coverUrl: a.coverUrl }));
      break;
    }
    case "artist": {
      const artists = await Artist.find(regex ? { stageName: regex } : {})
        .sort({ createdAt: -1 })
        .limit(15)
        .select("stageName coverUrl");
      results = artists.map((a) => ({ _id: a._id.toString(), title: a.stageName, coverUrl: a.coverUrl }));
      break;
    }
    case "playlist": {
      const playlists = await Playlist.find(regex ? { title: regex, isPublic: true } : { isPublic: true })
        .sort({ createdAt: -1 })
        .limit(15)
        .select("title coverUrl");
      results = playlists.map((p) => ({ _id: p._id.toString(), title: p.title, coverUrl: p.coverUrl }));
      break;
    }
    case "event": {
      const events = await Event.find(regex ? { title: regex } : {})
        .sort({ date: -1 })
        .limit(15)
        .select("title coverUrl");
      results = events.map((e) => ({ _id: e._id.toString(), title: e.title, coverUrl: e.coverUrl }));
      break;
    }
  }

  return NextResponse.json({ results });
});
