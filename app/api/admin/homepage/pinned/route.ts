import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import HomepagePinned, { IHomepagePinned } from "@/models/HomepagePinned";
import Song from "@/models/Song";
import Album from "@/models/Album";
import Artist from "@/models/Artist";
import Playlist from "@/models/Playlist";
import Event from "@/models/Event";
import { requireAdmin } from "@/lib/requireAdmin";
import { withApiErrors } from "@/lib/apiError";
import { parseOrThrow, pinnedContentSchema } from "@/lib/validation";

/** Résumé léger (titre + couverture) pour l'affichage des cartes épinglées côté admin. */
async function describePinned(pinned: IHomepagePinned & { _id: unknown }) {
  if (pinned.contentType === "custom") {
    return {
      _id: pinned._id,
      contentType: pinned.contentType,
      contentId: pinned.contentId,
      section: pinned.section,
      priority: pinned.priority,
      startDate: pinned.startDate,
      endDate: pinned.endDate,
      title: pinned.customTitle || "Bannière personnalisée",
      coverUrl: pinned.customCoverUrl,
    };
  }

  let title = "Contenu introuvable";
  let coverUrl: string | undefined;

  switch (pinned.contentType) {
    case "song": {
      const song = await Song.findById(pinned.contentId).select("title coverUrl");
      if (song) {
        title = song.title;
        coverUrl = song.coverUrl;
      }
      break;
    }
    case "album": {
      const album = await Album.findById(pinned.contentId).select("title coverUrl");
      if (album) {
        title = album.title;
        coverUrl = album.coverUrl;
      }
      break;
    }
    case "artist": {
      const artist = await Artist.findById(pinned.contentId).select("stageName coverUrl");
      if (artist) {
        title = artist.stageName;
        coverUrl = artist.coverUrl;
      }
      break;
    }
    case "playlist": {
      const playlist = await Playlist.findById(pinned.contentId).select("title coverUrl");
      if (playlist) {
        title = playlist.title;
        coverUrl = playlist.coverUrl;
      }
      break;
    }
    case "event": {
      const event = await Event.findById(pinned.contentId).select("title coverUrl");
      if (event) {
        title = event.title;
        coverUrl = event.coverUrl;
      }
      break;
    }
  }

  return {
    _id: pinned._id,
    contentType: pinned.contentType,
    contentId: pinned.contentId,
    section: pinned.section,
    priority: pinned.priority,
    startDate: pinned.startDate,
    endDate: pinned.endDate,
    title,
    coverUrl,
  };
}

export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin(req);
  await connectDB();
  const pinned = await HomepagePinned.find().sort({ section: 1, priority: -1 });
  const described = await Promise.all(pinned.map(describePinned));
  return NextResponse.json({ pinned: described });
});

export const POST = withApiErrors(async (req: Request) => {
  const admin = await requireAdmin(req);
  const body = parseOrThrow(pinnedContentSchema, await req.json());

  await connectDB();

  const pinned =
    body.contentType === "custom"
      ? await HomepagePinned.create({
          contentType: "custom",
          customTitle: body.customTitle,
          customSubtitle: body.customSubtitle,
          customCoverUrl: body.customCoverUrl || undefined,
          customHref: body.customHref,
          section: body.section,
          priority: body.priority,
          startDate: body.startDate || undefined,
          endDate: body.endDate || undefined,
          createdBy: admin.user.id,
        })
      : await HomepagePinned.create({
          contentType: body.contentType,
          contentId: body.contentId,
          section: body.section,
          priority: body.priority,
          startDate: body.startDate || undefined,
          endDate: body.endDate || undefined,
          createdBy: admin.user.id,
        });

  return NextResponse.json({ pinned }, { status: 201 });
});
