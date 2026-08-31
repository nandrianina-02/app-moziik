import { connectDB, isDatabaseUnavailableError } from "@/lib/db";
import Song from "@/models/Song";
import Album from "@/models/Album";
import Artist from "@/models/Artist";
import Playlist from "@/models/Playlist";
import Event from "@/models/Event";
import Comment from "@/models/Comment";
import Play from "@/models/Play";
import Subscription from "@/models/Subscription";
import HomepagePinnedModel, { IHomepagePinned } from "@/models/HomepagePinned";
import { getHomepageSections } from "@/lib/homepageSections";
import { getHomepageSettings } from "@/lib/homepageSettings";
import { getSiteConfig } from "@/lib/siteConfig";
import { getForYouCards } from "@/lib/homepageHubCards";
import { hasPremiumAccess } from "@/lib/premium";
import { IHomepageSection, SectionPage } from "@/models/HomepageSection";
import { UNIVERS_PAR_DEFAUT, type Univers } from "@/lib/univers";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Normalise une valeur entre 0 et 1 par rapport au maximum d'un lot. Évite qu'une seule métrique domine le score. */
function normalize(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.min(value / max, 1);
}

async function activePinnedForSection(sectionKey: string) {
  const now = new Date();
  const pinned = await HomepagePinnedModel.find({
    section: sectionKey,
    $and: [
      { $or: [{ startDate: { $exists: false } }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: { $exists: false } }, { endDate: { $gte: now } }] },
    ],
  }).sort({ priority: -1 });
  return pinned;
}

/** Dernières sorties : tri par date décroissante, filtrées sur le statut publié (+ vérifié en option). */
async function getNewReleases(limit: number, verifiedOnly: boolean, univers: Univers) {
  const artistFilter = verifiedOnly ? { verified: true } : {};
  const verifiedArtistIds = verifiedOnly ? await Artist.find(artistFilter).distinct("_id") : null;

  const query: Record<string, unknown> = { status: "published", univers };
  if (verifiedArtistIds) query.artist = { $in: verifiedArtistIds };

  return Song.find(query)
    .populate("artist", "stageName verified")
    .sort({ releaseDate: -1 })
    .limit(limit);
}

/**
 * Top des titres : score = 40% écoutes + 30% likes + 20% partages + 10% ajouts en playlist.
 * On part d'un lot de candidats (les 150 sons les plus écoutés) pour rester performant,
 * puis on normalise chaque métrique sur ce lot avant de pondérer.
 */
async function getTopTracks(limit: number, verifiedOnly: boolean, univers: Univers) {
  const artistFilter = verifiedOnly ? { verified: true } : {};
  const verifiedArtistIds = verifiedOnly ? await Artist.find(artistFilter).distinct("_id") : null;

  const query: Record<string, unknown> = { status: "published", univers };
  if (verifiedArtistIds) query.artist = { $in: verifiedArtistIds };

  const candidates = await Song.find(query)
    .populate("artist", "stageName verified")
    .sort({ playsCount: -1 })
    .limit(150);

  if (candidates.length === 0) return [];

  const playlistAdds = await Playlist.aggregate([
    { $unwind: "$songs" },
    { $match: { songs: { $in: candidates.map((c) => c._id) } } },
    { $group: { _id: "$songs", count: { $sum: 1 } } },
  ]);
  const addsBySong = new Map(playlistAdds.map((p) => [p._id.toString(), p.count as number]));

  const maxPlays = Math.max(...candidates.map((c) => c.playsCount));
  const maxLikes = Math.max(...candidates.map((c) => c.likesCount));
  const maxShares = Math.max(...candidates.map((c) => c.sharesCount ?? 0));
  const maxAdds = Math.max(...candidates.map((c) => addsBySong.get(c._id.toString()) ?? 0), 1);

  const scored = candidates.map((song) => {
    const adds = addsBySong.get(song._id.toString()) ?? 0;
    const score =
      0.4 * normalize(song.playsCount, maxPlays) +
      0.3 * normalize(song.likesCount, maxLikes) +
      0.2 * normalize(song.sharesCount ?? 0, maxShares) +
      0.1 * normalize(adds, maxAdds);
    return { song, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.song);
}

/**
 * Albums populaires : score basé sur les écoutes, les favoris (proxy : likes
 * cumulés des titres, aucun "favori album" dédié n'existe en base), la
 * croissance récente (écoutes 7 derniers jours vs 7 précédents) et les
 * commentaires sur les titres de l'album.
 */
async function getPopularAlbums(limit: number, univers: Univers) {
  const albums = await Album.find({ univers })
    .populate("artist", "stageName verified")
    .populate("songs", "playsCount likesCount")
    .sort({ releaseDate: -1 })
    .limit(60);

  if (albums.length === 0) return [];

  const now = Date.now();
  const since7 = new Date(now - 7 * DAY_MS);
  const sincePrev7 = new Date(now - 14 * DAY_MS);

  const allSongIds = albums.flatMap((a) => a.songs.map((s: { _id: unknown }) => s._id));

  const [recentPlays, previousPlays, comments] = await Promise.all([
    Play.aggregate([
      { $match: { song: { $in: allSongIds }, playedAt: { $gte: since7 } } },
      { $group: { _id: "$song", count: { $sum: 1 } } },
    ]),
    Play.aggregate([
      { $match: { song: { $in: allSongIds }, playedAt: { $gte: sincePrev7, $lt: since7 } } },
      { $group: { _id: "$song", count: { $sum: 1 } } },
    ]),
    Comment.aggregate([{ $match: { song: { $in: allSongIds } } }, { $group: { _id: "$song", count: { $sum: 1 } } }]),
  ]);
  const recentBySong = new Map(recentPlays.map((p) => [p._id.toString(), p.count as number]));
  const prevBySong = new Map(previousPlays.map((p) => [p._id.toString(), p.count as number]));
  const commentsBySong = new Map(comments.map((c) => [c._id.toString(), c.count as number]));

  const stats = albums.map((album) => {
    const songs = album.songs as unknown as { _id: { toString: () => string }; playsCount: number; likesCount: number }[];
    const totalPlays = songs.reduce((sum, s) => sum + (s.playsCount ?? 0), 0);
    const totalLikes = songs.reduce((sum, s) => sum + (s.likesCount ?? 0), 0);
    const recent = songs.reduce((sum, s) => sum + (recentBySong.get(s._id.toString()) ?? 0), 0);
    const prev = songs.reduce((sum, s) => sum + (prevBySong.get(s._id.toString()) ?? 0), 0);
    const growth = Math.max(recent - prev, 0);
    const totalComments = songs.reduce((sum, s) => sum + (commentsBySong.get(s._id.toString()) ?? 0), 0);
    return { album, totalPlays, totalLikes, growth, totalComments };
  });

  const maxPlays = Math.max(...stats.map((s) => s.totalPlays), 1);
  const maxLikes = Math.max(...stats.map((s) => s.totalLikes), 1);
  const maxGrowth = Math.max(...stats.map((s) => s.growth), 1);
  const maxComments = Math.max(...stats.map((s) => s.totalComments), 1);

  const scored = stats.map((s) => ({
    album: s.album,
    score:
      0.4 * normalize(s.totalPlays, maxPlays) +
      0.3 * normalize(s.totalLikes, maxLikes) +
      0.2 * normalize(s.growth, maxGrowth) +
      0.1 * normalize(s.totalComments, maxComments),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.album);
}

/**
 * Artistes tendance : score basé sur les abonnés, les écoutes récentes,
 * l'engagement (commentaires + likes sur leurs titres) et les nouvelles
 * sorties (30 derniers jours).
 */
async function getTrendingArtists(limit: number, verifiedOnly: boolean, univers: Univers) {
  const query: Record<string, unknown> = verifiedOnly ? { verified: true, univers } : { univers };
  const artists = await Artist.find(query).limit(80);
  if (artists.length === 0) return [];

  const since30 = new Date(Date.now() - 30 * DAY_MS);
  const artistIds = artists.map((a) => a._id);

  const songs = await Song.find({ artist: { $in: artistIds }, status: "published", univers }).select(
    "artist playsCount likesCount releaseDate createdAt"
  );
  const songIds = songs.map((s) => s._id);
  const comments = await Comment.aggregate([
    { $match: { song: { $in: songIds } } },
    { $group: { _id: "$song", count: { $sum: 1 } } },
  ]);
  const commentsBySong = new Map(comments.map((c) => [c._id.toString(), c.count as number]));

  const stats = artists.map((artist) => {
    const artistSongs = songs.filter((s) => s.artist.toString() === artist._id.toString());
    const plays = artistSongs.reduce((sum, s) => sum + (s.playsCount ?? 0), 0);
    const engagement = artistSongs.reduce(
      (sum, s) => sum + (s.likesCount ?? 0) + (commentsBySong.get(s._id.toString()) ?? 0),
      0
    );
    const newReleases = artistSongs.filter((s) => s.releaseDate >= since30).length;
    return { artist, followers: artist.followers.length, plays, engagement, newReleases };
  });

  const maxFollowers = Math.max(...stats.map((s) => s.followers), 1);
  const maxPlays = Math.max(...stats.map((s) => s.plays), 1);
  const maxEngagement = Math.max(...stats.map((s) => s.engagement), 1);
  const maxReleases = Math.max(...stats.map((s) => s.newReleases), 1);

  const scored = stats.map((s) => ({
    artist: s.artist,
    followersCount: s.followers,
    score:
      0.3 * normalize(s.followers, maxFollowers) +
      0.3 * normalize(s.plays, maxPlays) +
      0.2 * normalize(s.engagement, maxEngagement) +
      0.2 * normalize(s.newReleases, maxReleases),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => ({ ...s.artist.toObject(), followersCount: s.followersCount }));
}

/** Playlists populaires : playlists publiques triées par nombre d'abonnés puis taille. */
async function getPopularPlaylists(limit: number, univers: Univers) {
  const playlists = await Playlist.find({ isPublic: true, univers })
    .sort({ followers: -1, createdAt: -1 })
    .limit(limit)
    .populate({ path: "songs", select: "artist", populate: { path: "artist", select: "stageName coverUrl" } });

  return playlists.map((p) => {
    const songs = p.songs as unknown as { artist?: { _id: { toString: () => string }; stageName: string; coverUrl?: string } }[];
    const seenArtists = new Set<string>();
    const contributorAvatars: { name: string; coverUrl?: string }[] = [];
    for (const song of songs) {
      const artist = song.artist;
      if (!artist || seenArtists.has(artist._id.toString())) continue;
      seenArtists.add(artist._id.toString());
      contributorAvatars.push({ name: artist.stageName, coverUrl: artist.coverUrl });
      if (contributorAvatars.length >= 3) break;
    }

    return {
      _id: p._id,
      title: p.title,
      coverUrl: p.coverUrl,
      songsCount: p.songs.length,
      followersCount: p.followers.length,
      contributorAvatars,
    };
  });
}

/** Genres / ambiances : genres distincts des titres publiés, triés par popularité (nombre de titres). */
async function getGenreTiles(limit: number, univers: Univers) {
  const results = await Song.aggregate([
    { $match: { status: "published", univers } },
    { $group: { _id: "$genre", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
  return results.map((r) => ({ genre: r._id as string, count: r.count as number }));
}

/**
 * Recommandations : analyse des genres écoutés récemment par l'utilisateur
 * (historique de lecture). Anonyme ou sans historique -> les titres les
 * plus populaires en repli.
 */
async function getRecommendations(userId: string | undefined, limit: number, univers: Univers) {
  if (!userId) {
    return Song.find({ status: "published", univers })
      .populate("artist", "stageName verified")
      .sort({ playsCount: -1 })
      .limit(limit);
  }

  const since = new Date(Date.now() - 30 * DAY_MS);
  // L'historique est lu dans le seul univers courant : une écoute de
  // louange ne doit pas peser sur une recommandation générale, ni
  // l'inverse.
  const recentPlays = await Play.find({ user: userId, univers, playedAt: { $gte: since } }).populate({
    path: "song",
    select: "genre",
  });

  const genreCounts = new Map<string, number>();
  const listenedSongIds = new Set<string>();
  for (const play of recentPlays) {
    const song = play.song as unknown as { _id: { toString: () => string }; genre?: string } | null;
    if (!song) continue;
    listenedSongIds.add(song._id.toString());
    if (song.genre) genreCounts.set(song.genre, (genreCounts.get(song.genre) ?? 0) + 1);
  }

  const topGenres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => g);

  if (topGenres.length === 0) {
    return Song.find({ status: "published", univers })
      .populate("artist", "stageName verified")
      .sort({ playsCount: -1 })
      .limit(limit);
  }

  return Song.find({
    status: "published",
    univers,
    genre: { $in: topGenres },
    _id: { $nin: [...listenedSongIds] },
  })
    .populate("artist", "stageName verified")
    .sort({ playsCount: -1 })
    .limit(limit);
}

/**
 * Écoutes récentes de l'utilisateur connecté : les derniers titres
 * distincts qu'il a lancés, du plus récent au plus ancien. Un titre
 * réécouté plusieurs fois n'apparaît qu'une fois, à sa position la plus
 * récente. Vide pour un visiteur non connecté (section personnelle).
 */
async function getRecentlyPlayed(userId: string | undefined, limit: number, univers: Univers) {
  if (!userId) return [];

  // On lit un peu plus large que `limit` pour absorber les doublons
  // (le même titre réécouté plusieurs fois) avant de dédupliquer.
  const plays = await Play.find({ user: userId, univers })
    .sort({ playedAt: -1 })
    .limit(limit * 5)
    .populate({ path: "song", populate: { path: "artist", select: "stageName verified" } });

  const seen = new Set<string>();
  const songs: unknown[] = [];

  for (const play of plays) {
    const song = play.song as unknown as { _id: { toString: () => string }; status: string } | null;
    if (!song || song.status !== "published") continue;
    const id = song._id.toString();
    if (seen.has(id)) continue;
    seen.add(id);
    songs.push(song);
    if (songs.length >= limit) break;
  }

  return songs;
}

async function getEventsSummary(limit: number) {
  const now = new Date();
  const upcoming = await Event.find({ status: "published", date: { $gte: now } })
    .populate("artist", "stageName verified")
    .sort({ date: 1 })
    .limit(limit);
  const upcomingCount = await Event.countDocuments({ status: "published", date: { $gte: now } });
  return { upcomingCount, events: upcoming };
}

/**
 * Activité récente : dérivée des évènements datés déjà en base (nouveaux
 * titres publiés, nouveaux évènements créés) — pas de journal d'activité
 * dédié pour l'instant, donc les abonnements/paliers d'écoutes n'y
 * figurent pas encore.
 */
async function getRecentActivity(limit: number, univers: Univers) {
  const [songs, events] = await Promise.all([
    Song.find({ status: "published", univers })
      .populate("artist", "stageName verified")
      .sort({ createdAt: -1 })
      .limit(limit),
    Event.find({ status: "published" }).populate("artist", "stageName verified").sort({ createdAt: -1 }).limit(limit),
  ]);

  type ActivityItem = { type: "new_song" | "new_event"; message: string; link: string; at: Date; verified: boolean };

  const items: ActivityItem[] = [
    ...songs
      .filter((s) => s.artist)
      .map((s) => {
        const artist = s.artist as unknown as { stageName: string; verified: boolean };
        return {
          type: "new_song" as const,
          message: `${artist.stageName} vient de publier "${s.title}"`,
          link: `/son/${s._id}`,
          at: s.createdAt,
          verified: artist.verified,
        };
      }),
    ...events.map((e) => {
      const artist = e.artist as unknown as { stageName: string; verified: boolean } | undefined;
      return {
        type: "new_event" as const,
        message: artist ? `${artist.stageName} organise "${e.title}"` : `Nouvel évènement : "${e.title}"`,
        link: `/evenements`,
        at: e.createdAt,
        verified: artist?.verified ?? false,
      };
    }),
  ];

  items.sort((a, b) => b.at.getTime() - a.at.getTime());
  return items.slice(0, limit);
}

/**
 * Bannière principale : priorité 1) contenu sponsorisé/épinglé actif,
 * 2) nouvelle sortie marquante (la plus écoutée des 14 derniers jours),
 * 3) titre le plus populaire toutes périodes, 4) playlist tendance.
 */
async function getHero(heroMode: "auto" | "manual", univers: Univers) {
  const pinned = await activePinnedForSection("hero");
  // Une bannière épinglée hors de l'univers courant est passée plutôt
  // qu'affichée : l'admin la pose pour l'un des deux publics, et la
  // montrer à l'autre serait exactement le mélange qu'on évite.
  for (const candidat of pinned) {
    const resolved = await resolvePinnedContent(candidat);
    if (resolved && appartientALUnivers(resolved, univers)) {
      return { source: "pinned" as const, ...resolved };
    }
  }

  if (heroMode === "manual") return null;

  const since14 = new Date(Date.now() - 14 * DAY_MS);
  const recentImportant = await Song.findOne({ status: "published", univers, releaseDate: { $gte: since14 } })
    .populate("artist", "stageName verified")
    .sort({ playsCount: -1 });
  if (recentImportant) return { source: "new_release" as const, contentType: "song" as const, song: recentImportant };

  const mostPopular = await Song.findOne({ status: "published", univers })
    .populate("artist", "stageName verified")
    .sort({ playsCount: -1 });
  if (mostPopular) return { source: "popular" as const, contentType: "song" as const, song: mostPopular };

  const trendingPlaylist = await Playlist.findOne({ isPublic: true, univers }).sort({ followers: -1 });
  if (trendingPlaylist) return { source: "playlist" as const, contentType: "playlist" as const, playlist: trendingPlaylist };

  return null;
}

async function resolvePinnedContent(pinned: IHomepagePinned) {
  switch (pinned.contentType) {
    case "custom":
      // Bannière libre : pas de contenu réel sous-jacent, tout vient des
      // champs saisis par l'admin.
      return {
        contentType: "custom" as const,
        custom: {
          title: pinned.customTitle ?? "",
          subtitle: pinned.customSubtitle,
          coverUrl: pinned.customCoverUrl,
          href: pinned.customHref || "/",
        },
      };
    case "song": {
      const song = await Song.findById(pinned.contentId).populate("artist", "stageName verified");
      return song ? { contentType: "song" as const, song } : null;
    }
    case "album": {
      const album = await Album.findById(pinned.contentId).populate("artist", "stageName verified");
      return album ? { contentType: "album" as const, album } : null;
    }
    case "artist": {
      const artist = await Artist.findById(pinned.contentId);
      return artist ? { contentType: "artist" as const, artist } : null;
    }
    case "playlist": {
      const playlist = await Playlist.findById(pinned.contentId).populate({
        path: "songs",
        select: "artist",
        populate: { path: "artist", select: "stageName coverUrl" },
      });
      return playlist ? { contentType: "playlist" as const, playlist } : null;
    }
    case "event": {
      const event = await Event.findById(pinned.contentId).populate("artist", "stageName verified");
      return event ? { contentType: "event" as const, event } : null;
    }
    default:
      return null;
  }
}

type ResolvedPinnedContent = NonNullable<Awaited<ReturnType<typeof resolvePinnedContent>>>;

/**
 * Un contenu épinglé par l'administration a-t-il sa place dans cet univers ?
 *
 * Épingler est une décision éditoriale, mais elle vise un public : mettre
 * en avant un titre de louange auprès de qui a choisi l'univers général
 * annulerait la séparation là où elle se voit le plus — en haut de la
 * page d'accueil. Les bannières libres (« custom ») n'ont pas d'univers
 * puisqu'elles n'ont pas de contenu derrière : elles restent visibles des
 * deux côtés, ce qui est la seule réponse possible.
 */
function appartientALUnivers(resolved: ResolvedPinnedContent, univers: Univers): boolean {
  const porteur = resolved as {
    contentType: string;
    song?: { univers?: Univers };
    album?: { univers?: Univers };
    artist?: { univers?: Univers };
    playlist?: { univers?: Univers };
  };
  const contenu = porteur.song ?? porteur.album ?? porteur.artist ?? porteur.playlist;
  if (!contenu) return true;
  return (contenu.univers ?? UNIVERS_PAR_DEFAUT) === univers;
}

/** Convertit une liste de contenus épinglés résolus dans la forme exacte attendue par le frontend pour cette section. */
function formatManualSection(key: IHomepageSection["key"], resolved: ResolvedPinnedContent[]) {
  switch (key) {
    case "new_releases":
    case "top_tracks":
    case "recommendations":
      return resolved.filter((r) => r.contentType === "song").map((r) => (r as { song: unknown }).song);
    case "albums":
      return resolved.filter((r) => r.contentType === "album").map((r) => (r as { album: unknown }).album);
    case "trending_artists":
      return resolved
        .filter((r) => r.contentType === "artist")
        .map((r) => {
          const artist = (r as { artist: { toObject: () => Record<string, unknown>; followers: unknown[] } }).artist;
          const obj = artist.toObject();
          return { ...obj, followersCount: artist.followers.length };
        });
    case "playlists":
      return resolved
        .filter((r) => r.contentType === "playlist")
        .map((r) => {
          const playlist = (
            r as {
              playlist: {
                _id: unknown;
                title: string;
                coverUrl?: string;
                songs: { artist?: { _id: { toString: () => string }; stageName: string; coverUrl?: string } }[];
                followers: unknown[];
              };
            }
          ).playlist;

          const seenArtists = new Set<string>();
          const contributorAvatars: { name: string; coverUrl?: string }[] = [];
          for (const song of playlist.songs) {
            const artist = song.artist;
            if (!artist || seenArtists.has(artist._id.toString())) continue;
            seenArtists.add(artist._id.toString());
            contributorAvatars.push({ name: artist.stageName, coverUrl: artist.coverUrl });
            if (contributorAvatars.length >= 3) break;
          }

          return {
            _id: playlist._id,
            title: playlist.title,
            coverUrl: playlist.coverUrl,
            songsCount: playlist.songs.length,
            followersCount: playlist.followers.length,
            contributorAvatars,
          };
        });
    case "events":
      return {
        upcomingCount: resolved.filter((r) => r.contentType === "event").length,
        events: resolved.filter((r) => r.contentType === "event").map((r) => (r as { event: unknown }).event),
      };
    case "custom":
      // Collection libre créée par l'admin : mélange de titres, albums,
      // artistes, playlists ou évènements, normalisés vers une forme
      // générique (titre + couverture + lien) pour un rendu uniforme.
      return resolved.map((r) => {
        switch (r.contentType) {
          case "song": {
            const song = (r as { song: { _id: unknown; title: string; coverUrl: string } }).song;
            return { contentType: "song", _id: song._id, title: song.title, coverUrl: song.coverUrl, href: `/son/${song._id}` };
          }
          case "album": {
            const album = (r as { album: { _id: unknown; title: string; coverUrl: string } }).album;
            return { contentType: "album", _id: album._id, title: album.title, coverUrl: album.coverUrl, href: `/album/${album._id}` };
          }
          case "artist": {
            const artist = (r as { artist: { _id: unknown; stageName: string; coverUrl?: string } }).artist;
            return {
              contentType: "artist",
              _id: artist._id,
              title: artist.stageName,
              coverUrl: artist.coverUrl,
              href: `/artiste/${artist._id}`,
            };
          }
          case "playlist": {
            const playlist = (r as { playlist: { _id: unknown; title: string; coverUrl?: string } }).playlist;
            return {
              contentType: "playlist",
              _id: playlist._id,
              title: playlist.title,
              coverUrl: playlist.coverUrl,
              href: `/playlist/${playlist._id}`,
            };
          }
          case "event": {
            const event = (r as { event: { _id: unknown; title: string; coverUrl?: string } }).event;
            return { contentType: "event", _id: event._id, title: event.title, coverUrl: event.coverUrl, href: `/evenements` };
          }
          case "custom": {
            const custom = (r as { custom: { title: string; coverUrl?: string; href: string } }).custom;
            return { contentType: "custom", _id: custom.href, title: custom.title, coverUrl: custom.coverUrl, href: custom.href };
          }
        }
      });
    default:
      return [];
  }
}

export type HomepageSectionPayload = {
  key: IHomepageSection["key"];
  title: string;
  data: unknown;
};

/** Visiteur courant, ou null pour un anonyme. Le rôle sert à évaluer l'accès Premium. */
export type HomepageViewer = { id: string; role?: string } | null;

// Le mode manuel n'a de sens que pour les sections qui listent du contenu
// identifiable (titres, playlists, albums, artistes, évènements) : on
// reformate le contenu épinglé pour qu'il ait exactement la même forme que
// la sortie de l'algorithme, sinon le frontend ne saurait pas l'afficher.
// Les autres sections (genres, radio, activité, premium) n'ont pas de
// notion de contenu épinglé et restent pilotées par leur calcul habituel.
const MANUAL_CAPABLE_KEYS: IHomepageSection["key"][] = [
  "new_releases",
  "top_tracks",
  "recommendations",
  "playlists",
  "albums",
  "trending_artists",
  "events",
  "custom",
];

type SectionContext = {
  viewer: HomepageViewer;
  /** Univers musical de ce visiteur : il filtre absolument toutes les sections. */
  univers: Univers;
  settings: Awaited<ReturnType<typeof getHomepageSettings>>;
  siteConfig: Awaited<ReturnType<typeof getSiteConfig>>;
};

/** L'abonnement du visiteur, lu une seule fois même si plusieurs sections en dépendent. */
async function isSubscriber(viewer: HomepageViewer) {
  if (!viewer) return false;
  const subscription = await Subscription.findOne({ user: viewer.id }).sort({ startedAt: -1 });
  return hasPremiumAccess({ role: viewer.role, subscriptionStatus: subscription?.status });
}

/** Calcule les données d'une seule section. Ne rejette jamais pour une panne isolée : voir buildSection. */
async function computeSection(section: IHomepageSection, ctx: SectionContext): Promise<unknown> {
  const userId = ctx.viewer?.id;
  const univers = ctx.univers;

  if (section.mode === "manual" && MANUAL_CAPABLE_KEYS.includes(section.key)) {
    // On résout plus large que la limite : les contenus de l'autre
    // univers sont écartés ensuite, et une section n'a pas à se vider
    // parce que les premiers épinglés visaient l'autre public.
    const pinned = await activePinnedForSection(section.slug ?? section.key);
    const resolved = (await Promise.all(pinned.map(resolvePinnedContent)))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .filter((r) => appartientALUnivers(r, univers))
      .slice(0, section.limit);
    return formatManualSection(section.key, resolved);
  }

  switch (section.key) {
    case "for_you":
      return getForYouCards(section.limit, userId, univers);
    case "recently_played":
      return getRecentlyPlayed(userId, section.limit, univers);
    case "new_releases":
      return getNewReleases(section.limit, section.filters.verifiedOnly, univers);
    case "top_tracks":
      return getTopTracks(section.limit, section.filters.verifiedOnly, univers);
    case "albums":
      return getPopularAlbums(section.limit, univers);
    case "trending_artists":
      return getTrendingArtists(section.limit, section.filters.verifiedOnly, univers);
    case "recommendations":
      return ctx.settings.recommendationMode === "auto"
        ? getRecommendations(userId, section.limit, univers)
        : [];
    case "playlists":
      return getPopularPlaylists(section.limit, univers);
    case "genres":
      return getGenreTiles(section.limit, univers);
    case "events":
      // Volontairement non filtré : un concert n'est pas un morceau qu'on
      // enchaîne, et le catalogue ne dit pas si une salle programme du
      // gospel ou de la variété. Filtrer sur l'univers de l'artiste ferait
      // disparaître des dates réelles sur une donnée qui n'a pas été
      // saisie pour ça.
      return getEventsSummary(section.limit);
    case "radio":
      return { active: true };
    case "activity":
      return getRecentActivity(section.limit, univers);
    case "premium":
      return { plans: ctx.siteConfig.plans, isSubscriber: await isSubscriber(ctx.viewer) };
    default:
      return null;
  }
}

/**
 * Enveloppe `computeSection` pour qu'une section en échec n'emporte pas
 * toute la page : elle est simplement omise, et l'incident est journalisé.
 * Une base injoignable reste propagée — ce n'est pas un contenu manquant
 * mais une panne, et l'appelant doit pouvoir répondre 503 (voir
 * lib/apiError.ts) plutôt que servir une page vide qui ressemble à un site
 * sans contenu.
 */
async function buildSection(section: IHomepageSection, ctx: SectionContext): Promise<HomepageSectionPayload | null> {
  try {
    const data = await computeSection(section, ctx);
    if (data === null) return null;
    return { key: section.key, title: section.title, data };
  } catch (err) {
    if (isDatabaseUnavailableError(err)) throw err;
    console.error(`[homepage] section "${section.slug ?? section.key}" en échec`, err);
    return null;
  }
}

/**
 * Lance le calcul de toutes les sections **en parallèle** et rend la main
 * immédiatement, sans rien attendre.
 *
 * Le moteur enchaînait auparavant les sections dans une boucle `for await` :
 * la page d'accueil coûtait donc la *somme* des ~14 sections, chacune valant
 * de un à cinq aller-retours vers MongoDB. Comme aucune section ne dépend
 * d'une autre, cette mise en série était pure attente.
 *
 * Renvoyer les promesses plutôt que les résultats permet à l'appelant de
 * diffuser chaque section dès qu'elle est prête (voir
 * app/api/homepage/stream/route.ts) au lieu d'attendre la plus lente.
 */
export async function preparePageSections(page: SectionPage, viewer: HomepageViewer, univers: Univers) {
  await connectDB();

  const [sections, settings, siteConfig] = await Promise.all([
    getHomepageSections(page),
    getHomepageSettings(),
    getSiteConfig(),
  ]);

  const ctx: SectionContext = { viewer, univers, settings, siteConfig };
  const enabled = sections.filter((s) => s.enabled);

  return {
    // La bannière est propre à l'accueil : ailleurs, la page a déjà son
    // propre en-tête et une seconde bannière ferait doublon.
    hero:
      page === "home" && enabled.some((s) => s.key === "hero")
        ? getHero(settings.heroMode, univers)
        : Promise.resolve(null),
    sections: enabled
      .filter((s) => s.key !== "hero")
      .map((section) => ({
        key: section.key,
        title: section.title,
        payload: buildSection(section, ctx),
      })),
  };
}

/** Raccourci pour l'accueil. */
export function prepareHomepage(viewer: HomepageViewer, univers: Univers) {
  return preparePageSections("home", viewer, univers);
}

/** Construit l'intégralité du payload d'une page à partir de la config admin et des données live. */
export async function getPageSectionsData(page: SectionPage, viewer: HomepageViewer, univers: Univers) {
  const prepared = await preparePageSections(page, viewer, univers);
  const [hero, sections] = await Promise.all([
    prepared.hero,
    Promise.all(prepared.sections.map((s) => s.payload)),
  ]);

  return { hero, sections: sections.filter((s): s is HomepageSectionPayload => s !== null) };
}

/** Construit l'intégralité du payload /api/homepage. */
export function getHomepageData(viewer: HomepageViewer, univers: Univers) {
  return getPageSectionsData("home", viewer, univers);
}
