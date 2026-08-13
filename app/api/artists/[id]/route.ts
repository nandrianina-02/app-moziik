import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Artist from "@/models/Artist";
import Song from "@/models/Song";
import Album from "@/models/Album";
import Playlist from "@/models/Playlist";
import Comment from "@/models/Comment";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const GET = withApiErrors(async (_req: Request, { params }: { params: { id: string } }) => {
  await connectDB();
  const artist = await Artist.findById(params.id);
  if (!artist) throw new ApiError("Artiste introuvable.", 404);

  const [songs, albumDocs] = await Promise.all([
    Song.find({ artist: artist._id, status: "published" })
      .populate("artist", "stageName verified")
      .sort({ releaseDate: -1 }),
    Album.find({ artist: artist._id }).sort({ releaseDate: -1 }),
  ]);

  const songIds = songs.map((s) => s._id);
  const totalLikes = songs.reduce((sum, s) => sum + (s.likesCount ?? 0), 0);

  const topSongs = [...songs].sort((a, b) => (b.playsCount ?? 0) - (a.playsCount ?? 0)).slice(0, 5);
  const albums = albumDocs.filter((a) => a.type !== "single");
  const singles = albumDocs.filter((a) => a.type === "single");
  const recentReleases = songs.slice(0, 3);

  const [playlistsFeaturing, similarArtists, recentCommentsDocs] = await Promise.all([
    songIds.length > 0
      ? Playlist.find({ isPublic: true, songs: { $in: songIds } })
          .select("title coverUrl songs")
          .sort({ createdAt: -1 })
          .limit(6)
      : [],
    Artist.find({
      _id: { $ne: artist._id },
      ...(artist.genres.length > 0 ? { genres: { $in: artist.genres } } : {}),
    })
      .select("stageName coverUrl verified followers")
      .sort({ verified: -1, totalPlays: -1 })
      .limit(6),
    songIds.length > 0
      ? Comment.find({ song: { $in: songIds } })
          .populate("user", "name avatarUrl")
          .populate("song", "title")
          .sort({ createdAt: -1 })
          .limit(5)
      : [],
  ]);

  return NextResponse.json({
    artist: {
      _id: artist._id,
      stageName: artist.stageName,
      bio: artist.bio,
      coverUrl: artist.coverUrl,
      bannerUrl: artist.bannerUrl,
      genres: artist.genres,
      socialLinks: artist.socialLinks,
      verified: artist.verified,
      followersCount: artist.followers.length,
      songsCount: songs.length,
      albumsCount: albums.length,
      totalPlays: artist.totalPlays,
      totalLikes,
    },
    songs,
    topSongs,
    albums,
    singles,
    recentReleases,
    playlistsFeaturing: playlistsFeaturing.map((p) => ({
      _id: p._id,
      title: p.title,
      coverUrl: p.coverUrl,
      songsCount: p.songs.length,
    })),
    similarArtists: similarArtists.map((a) => ({
      _id: a._id,
      stageName: a.stageName,
      coverUrl: a.coverUrl,
      verified: a.verified,
      followersCount: a.followers.length,
    })),
    recentComments: recentCommentsDocs
      .filter((c: any) => c.user && c.song)
      .map((c: any) => ({
        _id: c._id,
        text: c.text,
        createdAt: c.createdAt,
        user: { name: c.user.name, avatarUrl: c.user.avatarUrl },
        songTitle: c.song.title,
      })),
  });
});
