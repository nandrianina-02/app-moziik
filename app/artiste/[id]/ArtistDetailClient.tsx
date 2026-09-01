"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  BadgeCheck,
  Users,
  Music2,
  Disc3,
  Play,
  Pause,
  Share2,
  MoreVertical,
  UserPlus,
  UserCheck,
  Camera,
  Pencil,
  Facebook,
  Instagram,
  Youtube,
  Globe,
  Clapperboard,
  Heart,
  MessageCircle,
} from "lucide-react";
import { usePlayer, type PlayableSong } from "@/context/PlayerProvider";
import { SafeImage } from "@/components/ui/SafeImage";
import { useToast } from "@/context/ToastProvider";
import { idbGet, idbPut, STORES } from "@/lib/offlineDb";
import { useLongPress } from "@/components/music/useLongPress";
import { ArtistContextMenu } from "@/components/artist/ArtistContextMenu";
import { ArtistDetailSkeleton } from "@/components/artist/ArtistDetailSkeleton";
import { PageSections } from "@/components/home/PageSections";
import { ArtistSongList } from "@/components/artist/ArtistSongList";
import { ExpandableText, ShowMoreButton, useProgressiveList } from "@/components/ui/ShowMore";
import { EditArtistProfileModal } from "@/components/artist/EditArtistProfileModal";
import { ShareModal } from "@/components/share/ShareModal";
import { buildArtistSubject } from "@/components/share/shareSubject";
import { uploadToCloudinaryClient } from "@/lib/cloudinaryClient";

const DEFAULT_BANNER = "/images/default-artist-banner.png";

type SocialLink = { platform: string; url: string };

type ArtistProfile = {
  _id: string;
  stageName: string;
  bio?: string;
  coverUrl?: string;
  bannerUrl?: string;
  genres: string[];
  socialLinks: SocialLink[];
  verified: boolean;
  followersCount: number;
  songsCount: number;
  albumsCount: number;
  totalPlays: number;
  totalLikes: number;
};

type AlbumSummary = { _id: string; title: string; coverUrl: string; type: "album" | "ep" | "single"; releaseDate?: string };
type PlaylistSummary = { _id: string; title: string; coverUrl?: string; songsCount: number };
type SimilarArtist = { _id: string; stageName: string; coverUrl?: string; verified?: boolean; followersCount: number };
type RecentComment = { _id: string; text: string; createdAt: string; user: { name: string; avatarUrl?: string }; songTitle: string };

type ArtistPageData = {
  artist: ArtistProfile;
  songs: PlayableSong[];
  topSongs: PlayableSong[];
  albums: AlbumSummary[];
  singles: AlbumSummary[];
  recentReleases: PlayableSong[];
  playlistsFeaturing: PlaylistSummary[];
  similarArtists: SimilarArtist[];
  recentComments: RecentComment[];
};

type TabKey = "accueil" | "morceaux" | "albums" | "singles" | "playlists" | "videos" | "apropos";

const TABS: { key: TabKey; label: string }[] = [
  { key: "accueil", label: "Accueil" },
  { key: "morceaux", label: "Morceaux" },
  { key: "albums", label: "Albums" },
  { key: "singles", label: "Singles" },
  { key: "playlists", label: "Playlists" },
  { key: "videos", label: "Vidéos" },
  { key: "apropos", label: "À propos" },
];

const SOCIAL_ICON: Record<string, typeof Facebook> = {
  facebook: Facebook,
  instagram: Instagram,
  tiktok: Music2,
  youtube: Youtube,
  website: Globe,
};

function timeAgo(iso?: string) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days < 1) return "Aujourd'hui";
  if (days < 7) return `Il y a ${days} jour${days > 1 ? "s" : ""}`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `Il y a ${weeks} semaine${weeks > 1 ? "s" : ""}`;
  const months = Math.floor(days / 30);
  return `Il y a ${months} mois`;
}

/**
 * Grille de pochettes (albums, singles, playlists) déroulée par paliers.
 * Composant à part plutôt que trois grilles inline : le crochet de déroulé
 * ne peut pas être appelé après le retour anticipé du squelette de
 * chargement, et les trois onglets affichaient déjà la même chose.
 */
function CoverGrid({
  items,
  moreLabel,
}: {
  items: { id: string; href: string; coverUrl?: string; title: string; subtitle: string }[];
  moreLabel: string;
}) {
  const { visible, hasMore, remaining, showMore } = useProgressiveList(items, { initial: 10, step: 20 });

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {visible.map((item) => (
          <Link key={item.id} href={item.href}>
            <SafeImage src={item.coverUrl} alt={item.title} width={160} height={160} className="mb-2 aspect-square w-full rounded-xl2 object-cover" />
            <p className="truncate text-sm">{item.title}</p>
            <p className="text-xs text-ink-muted">{item.subtitle}</p>
          </Link>
        ))}
      </div>

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <ShowMoreButton label={moreLabel} remaining={remaining} onClick={showMore} />
        </div>
      )}
    </div>
  );
}

function formatCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")} K`;
  return `${n}`;
}

export function ArtistDetailClient() {
  const { id } = useParams<{ id: string }>();
  const { status, data: session } = useSession();
  const pushToast = useToast();
  const { currentSong, isPlaying, playQueue, togglePlay } = usePlayer();

  const [data, setData] = useState<ArtistPageData | null>(null);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [tab, setTab] = useState<TabKey>("accueil");
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const bannerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const res = await fetch(`/api/artists/${id}`);
      if (!res.ok) throw new Error();
      const json: ArtistPageData = await res.json();
      setData(json);
      setFromCache(false);
      idbPut(STORES.artists, { _id: id, ...json }).catch(() => {});
    } catch {
      const cached = await idbGet<ArtistPageData & { _id: string }>(STORES.artists, id);
      if (cached) {
        setData(cached);
        setFromCache(true);
      } else {
        pushToast("error", "Impossible de charger ce profil.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (session?.user?.role !== "artist") {
      setIsOwnProfile(false);
      return;
    }
    fetch("/api/artist/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => setIsOwnProfile(!!d?.artist && d.artist._id === id))
      .catch(() => {});
  }, [session, id]);

  async function toggleFollow() {
    if (status !== "authenticated") {
      pushToast("error", "Connecte-toi pour suivre un artiste.");
      return;
    }
    const res = await fetch(`/api/artists/${id}/follow`, { method: "POST" });
    if (!res.ok) {
      pushToast("error", "Une erreur est survenue.");
      return;
    }
    const json = await res.json();
    setFollowing(json.following);
    setData((prev) => (prev ? { ...prev, artist: { ...prev.artist, followersCount: json.followersCount } } : prev));
    pushToast(
      "success",
      json.following ? `Tu suis maintenant ${data?.artist.stageName ?? "cet artiste"}.` : "Tu ne suis plus cet artiste."
    );
  }

  async function handleBannerFile(file: File) {
    setUploadingBanner(true);
    try {
      const { url } = await uploadToCloudinaryClient(file, "banners");
      const res = await fetch("/api/artist/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bannerUrl: url }),
      });
      if (!res.ok) throw new Error();
      setData((prev) => (prev ? { ...prev, artist: { ...prev.artist, bannerUrl: url } } : prev));
      pushToast("success", "Bannière mise à jour.");
    } catch {
      pushToast("error", "Échec de l'envoi de la bannière.");
    } finally {
      setUploadingBanner(false);
    }
  }

  async function handleAvatarFile(file: File) {
    setUploadingAvatar(true);
    try {
      const { url } = await uploadToCloudinaryClient(file, "avatars");
      const res = await fetch("/api/artist/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverUrl: url }),
      });
      if (!res.ok) throw new Error();
      setData((prev) => (prev ? { ...prev, artist: { ...prev.artist, coverUrl: url } } : prev));
      pushToast("success", "Photo de profil mise à jour.");
    } catch {
      pushToast("error", "Échec de l'envoi de la photo.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  function openMenuAt(x: number, y: number) {
    setMenuPosition({ x, y });
  }
  const longPress = useLongPress((x, y) => openMenuAt(x, y));

  if (loading || !data) return <ArtistDetailSkeleton />;

  const { artist, songs, topSongs, albums, singles, recentReleases, playlistsFeaturing, similarArtists, recentComments } = data;
  const isCurrentArtistPlaying = isPlaying && !!currentSong && songs.some((s) => s._id === currentSong._id);

  function handleMainPlay() {
    if (isCurrentArtistPlaying) {
      togglePlay();
      return;
    }
    const list = topSongs.length > 0 ? topSongs : songs;
    if (list.length === 0) return;
    playQueue(list, 0, { type: "artist", label: artist.stageName, id: artist._id });
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] pb-16">
      {fromCache && <p className="px-6 pt-4 text-xs text-accent md:px-10">Affiché depuis la version enregistrée (hors-ligne).</p>}

      {/* --- Bannière --- */}
      <div className="group relative h-48 w-full overflow-hidden sm:h-64 md:h-72">
        <SafeImage
          src={artist.bannerUrl || DEFAULT_BANNER}
          alt=""
          width={1600}
          height={500}
          className="h-full w-full object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {isOwnProfile && (
          <>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleBannerFile(e.target.files[0])}
            />
            <button
              onClick={() => bannerInputRef.current?.click()}
              disabled={uploadingBanner}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3.5 py-2 text-xs font-medium text-white backdrop-blur-sm disabled:opacity-100 au-survol"
            >
              <Camera size={13} /> {uploadingBanner ? "Envoi..." : "Modifier la bannière"}
            </button>
          </>
        )}

        {/* --- Identité superposée en bas de bannière --- */}
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 px-6 pb-4 md:px-10 md:pb-6">
          <div
            className="group/avatar relative shrink-0"
            onContextMenu={(e) => {
              e.preventDefault();
              openMenuAt(e.clientX, e.clientY);
            }}
            onTouchStart={longPress.onTouchStart}
            onTouchEnd={longPress.onTouchEnd}
            onTouchMove={longPress.onTouchMove}
          >
            <SafeImage
              src={artist.coverUrl}
              alt={artist.stageName}
              width={112}
              height={112}
              className="h-20 w-20 rounded-full border-4 border-base object-cover shadow-lg sm:h-28 sm:w-28"
            />
            {isOwnProfile && (
              <>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleAvatarFile(e.target.files[0])}
                />
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  aria-label="Modifier la photo de profil"
                  className="absolute bottom-0 right-0 grid h-7 w-7 place-items-center rounded-full bg-accent text-base opacity-0 transition-opacity group-hover/avatar:opacity-100"
                >
                  <Camera size={13} />
                </button>
              </>
            )}
          </div>
          <div className="min-w-0 pb-1 text-white">
            <h1 className="flex items-center gap-1.5 truncate text-xl font-display sm:text-2xl">
              {artist.stageName}
              {artist.verified && <BadgeCheck size={18} className="shrink-0 text-verified" />}
            </h1>
            {artist.genres.length > 0 && <p className="text-xs text-white/80 sm:text-sm">{artist.genres.join(" · ")}</p>}
          </div>
        </div>
      </div>

      <div className="px-6 md:px-10">
        {/* --- Stats + actions --- */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-muted sm:text-sm">
            <span className="flex items-center gap-1.5">
              <Users size={13} /> {formatCompact(artist.followersCount)} abonnés
            </span>
            <span className="flex items-center gap-1.5">
              <Music2 size={13} /> {artist.songsCount} morceaux
            </span>
            <span className="flex items-center gap-1.5">
              <Disc3 size={13} /> {artist.albumsCount} albums
            </span>
            <span className="flex items-center gap-1.5">
              <Play size={13} fill="currentColor" /> {formatCompact(artist.totalPlays)} écoutes
            </span>
          </div>

          <div className="flex w-full items-center gap-2 overflow-x-auto sm:w-auto">
            <button
              onClick={handleMainPlay}
              className="flex shrink-0 items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-medium text-base hover:bg-accent-hover"
            >
              {isCurrentArtistPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
              Lecture
            </button>
            {!isOwnProfile && (
              <button
                onClick={toggleFollow}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                  following ? "border border-border text-ink-muted hover:border-accent" : "border border-border hover:border-accent"
                }`}
              >
                {following ? <UserCheck size={15} /> : <UserPlus size={15} />}
                {following ? "Abonné" : "Suivre"}
              </button>
            )}
            <button
              onClick={() => setShowShareModal(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-5 py-2 text-sm font-medium text-ink-muted hover:border-accent hover:text-accent"
            >
              <Share2 size={14} /> Partager
            </button>
            <button
              onClick={(e) => openMenuAt(e.clientX, e.clientY)}
              aria-label="Plus d'options"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-ink-muted transition-colors hover:border-accent hover:text-accent"
            >
              <MoreVertical size={15} />
            </button>
          </div>
        </div>

        {/* --- Onglets --- */}
        <div className="-mx-6 overflow-x-auto px-6 md:-mx-10 md:px-10">
          <div className="flex w-max items-center gap-1 border-b border-border">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`relative whitespace-nowrap px-3.5 py-3 text-sm transition-colors ${
                  tab === key ? "font-medium text-ink" : "text-ink-muted hover:text-ink"
                }`}
              >
                {label}
                <span className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full ${tab === key ? "bg-accent" : "bg-transparent"}`} />
              </button>
            ))}
          </div>
        </div>

        {/* --- Contenu --- */}
        <div className="py-7">
          {tab === "accueil" && (
            <div className="space-y-10">
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base text-ink font-display">Morceaux populaires</h2>
                  {songs.length > 5 && (
                    <button onClick={() => setTab("morceaux")} className="text-xs font-medium text-accent hover:underline">
                      Voir tout
                    </button>
                  )}
                </div>
                {topSongs.length === 0 ? (
                  <p className="text-sm text-ink-muted">Pas encore de son publié.</p>
                ) : (
                  <ArtistSongList
                    songs={topSongs}
                    showRankFrom={1}
                    source={{ type: "artist", label: artist.stageName }}
                    onDeleted={load}
                  />
                )}
              </section>

              <div className="grid gap-8 lg:grid-cols-3">
                <div className="space-y-8 lg:col-span-2">
                  {albums.length > 0 && (
                    <section>
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-base text-ink font-display">Albums</h2>
                        <button onClick={() => setTab("albums")} className="text-xs font-medium text-accent hover:underline">
                          Voir tout
                        </button>
                      </div>
                      <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
                        {albums.slice(0, 6).map((album) => (
                          <Link key={album._id} href={`/album/${album._id}`} className="w-32 shrink-0 sm:w-36">
                            <SafeImage src={album.coverUrl} alt={album.title} width={144} height={144} className="mb-2 aspect-square w-full rounded-xl2 object-cover" />
                            <p className="truncate text-sm">{album.title}</p>
                            <p className="text-xs text-ink-muted">{album.releaseDate ? new Date(album.releaseDate).getFullYear() : ""}</p>
                          </Link>
                        ))}
                      </div>
                    </section>
                  )}

                  {artist.bio && (
                    <section className="rounded-xl2 border border-border bg-surface p-5">
                      <h2 className="mb-2 text-sm font-medium">À propos</h2>
                      {/* Repliée ici, entière dans l'onglet « À propos » :
                          une biographie longue ne doit pas repousser les
                          sections qui suivent hors de l'écran. */}
                      <ExpandableText text={artist.bio} className="text-sm text-ink-muted" />
                      {artist.socialLinks.length > 0 && (
                        <div className="mt-4 flex gap-3">
                          {artist.socialLinks.map((link, i) => {
                            const Icon = SOCIAL_ICON[link.platform] ?? Globe;
                            return (
                              <a
                                key={i}
                                href={link.url}
                                target="_blank"
                                rel="noreferrer"
                                className="grid h-8 w-8 place-items-center rounded-full border border-border text-ink-muted hover:border-accent hover:text-accent"
                              >
                                <Icon size={14} />
                              </a>
                            );
                          })}
                        </div>
                      )}
                      <button onClick={() => setTab("apropos")} className="mt-3 text-xs font-medium text-accent hover:underline">
                        Lire plus
                      </button>
                    </section>
                  )}

                  {recentComments.length > 0 && (
                    <section>
                      <h2 className="mb-3 flex items-center gap-1.5 text-base text-ink font-display">
                        <MessageCircle size={16} /> Commentaires récents
                      </h2>
                      <div className="space-y-3">
                        {recentComments.map((c) => (
                          <div key={c._id} className="flex gap-3">
                            <SafeImage src={c.user.avatarUrl} alt={c.user.name} width={32} height={32} className="mt-0.5 shrink-0 rounded-full object-cover" />
                            <div className="min-w-0">
                              <p className="flex items-center gap-2 text-xs">
                                <span className="font-medium">{c.user.name}</span>
                                <span className="text-ink-muted">{timeAgo(c.createdAt)}</span>
                              </p>
                              <p className="mt-0.5 text-sm text-ink-muted">{c.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>

                <div className="space-y-8">
                  {recentReleases.length > 0 && (
                    <section className="rounded-xl2 border border-border bg-surface p-4">
                      <h2 className="mb-3 text-sm font-medium">Dernières sorties</h2>
                      <div className="space-y-1">
                        {recentReleases.map((song) => {
                          const isNew = (() => {
                            const days = (Date.now() - new Date((song as any).releaseDate ?? (song as any).createdAt ?? 0).getTime()) / (24 * 60 * 60 * 1000);
                            return days < 14;
                          })();
                          return (
                            <div key={song._id} className="flex items-center gap-3 rounded-xl px-1.5 py-1.5">
                              <SafeImage src={song.coverUrl} alt={song.title} width={36} height={36} className="shrink-0 rounded-lg object-cover" />
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5 truncate text-sm">
                                  {song.title}
                                  {isNew && <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">Nouveau</span>}
                                </span>
                                <span className="block text-xs text-ink-muted">{timeAgo((song as any).releaseDate)}</span>
                              </span>
                              <button
                                onClick={() => playQueue(recentReleases, recentReleases.findIndex((s) => s._id === song._id), { type: "artist", label: artist.stageName, id: artist._id })}
                                aria-label="Lire"
                                className="shrink-0 grid h-8 w-8 place-items-center rounded-full border border-border text-ink-muted hover:border-accent hover:text-accent"
                              >
                                <Play size={12} fill="currentColor" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {playlistsFeaturing.length > 0 && (
                    <section className="rounded-xl2 border border-border bg-surface p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-medium">Playlists contenant cet artiste</h2>
                        {playlistsFeaturing.length > 3 && (
                          <button onClick={() => setTab("playlists")} className="text-xs font-medium text-accent hover:underline">
                            Voir tout
                          </button>
                        )}
                      </div>
                      <div className="space-y-1">
                        {playlistsFeaturing.slice(0, 3).map((p) => (
                          <Link key={p._id} href={`/playlist/${p._id}`} className="flex items-center gap-3 rounded-xl px-1.5 py-1.5 hover:bg-base">
                            <SafeImage src={p.coverUrl} alt={p.title} width={36} height={36} className="shrink-0 rounded-lg object-cover" />
                            <span className="min-w-0">
                              <span className="block truncate text-sm">{p.title}</span>
                              <span className="block text-xs text-ink-muted">{p.songsCount} titres</span>
                            </span>
                          </Link>
                        ))}
                      </div>
                    </section>
                  )}

                  <section className="rounded-xl2 border border-border bg-surface p-4">
                    <h2 className="mb-3 text-sm font-medium">Statistiques</h2>
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="rounded-xl bg-base p-3">
                        <p className="flex items-center justify-center gap-1 text-lg font-display">
                          <Play size={14} fill="currentColor" className="text-accent" /> {formatCompact(artist.totalPlays)}
                        </p>
                        <p className="text-[11px] text-ink-muted">Écoutes</p>
                      </div>
                      <div className="rounded-xl bg-base p-3">
                        <p className="flex items-center justify-center gap-1 text-lg font-display">
                          <Heart size={14} fill="currentColor" className="text-accent" /> {formatCompact(artist.totalLikes)}
                        </p>
                        <p className="text-[11px] text-ink-muted">Likes</p>
                      </div>
                      <div className="rounded-xl bg-base p-3">
                        <p className="text-lg font-display">{artist.songsCount}</p>
                        <p className="text-[11px] text-ink-muted">Morceaux</p>
                      </div>
                      <div className="rounded-xl bg-base p-3">
                        <p className="text-lg font-display">{artist.followersCount}</p>
                        <p className="text-[11px] text-ink-muted">Abonnés</p>
                      </div>
                    </div>
                  </section>
                </div>
              </div>

              {similarArtists.length > 0 && (
                <section>
                  <h2 className="mb-3 text-base text-ink font-display">Vous aimerez aussi</h2>
                  <div className="-mx-1 flex gap-5 overflow-x-auto px-1 pb-2">
                    {similarArtists.map((a) => (
                      <Link key={a._id} href={`/artiste/${a._id}`} className="w-24 shrink-0 text-center sm:w-28">
                        <SafeImage src={a.coverUrl} alt={a.stageName} width={112} height={112} className="mx-auto mb-2 h-20 w-20 rounded-full object-cover sm:h-28 sm:w-28" />
                        <p className="flex items-center justify-center gap-1 truncate text-xs font-medium">
                          {a.stageName}
                          {a.verified && <BadgeCheck size={11} className="shrink-0 text-verified" />}
                        </p>
                        <p className="text-[11px] text-ink-muted">{formatCompact(a.followersCount)} abonnés</p>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {tab === "morceaux" && (
            <div>
              {songs.length === 0 ? (
                <p className="text-sm text-ink-muted">Pas encore de son publié.</p>
              ) : (
                <ArtistSongList
                  songs={songs}
                  showRankFrom={1}
                  initialCount={10}
                  source={{ type: "artist", label: artist.stageName }}
                  onDeleted={load}
                />
              )}
            </div>
          )}

          {tab === "albums" && (
            <div>
              {albums.length === 0 ? (
                <p className="text-sm text-ink-muted">Pas encore d&apos;album.</p>
              ) : (
                <CoverGrid
                  items={albums.map((album) => ({
                    id: album._id,
                    href: `/album/${album._id}`,
                    coverUrl: album.coverUrl,
                    title: album.title,
                    subtitle: album.releaseDate ? String(new Date(album.releaseDate).getFullYear()) : "",
                  }))}
                  moreLabel="Voir plus d'albums"
                />
              )}
            </div>
          )}

          {tab === "singles" && (
            <div>
              {singles.length === 0 ? (
                <p className="text-sm text-ink-muted">Pas encore de single.</p>
              ) : (
                <CoverGrid
                  items={singles.map((single) => ({
                    id: single._id,
                    href: `/album/${single._id}`,
                    coverUrl: single.coverUrl,
                    title: single.title,
                    subtitle: single.releaseDate ? String(new Date(single.releaseDate).getFullYear()) : "",
                  }))}
                  moreLabel="Voir plus de singles"
                />
              )}
            </div>
          )}

          {tab === "playlists" && (
            <div>
              {playlistsFeaturing.length === 0 ? (
                <p className="text-sm text-ink-muted">Cet artiste n&apos;apparaît dans aucune playlist publique pour l&apos;instant.</p>
              ) : (
                <CoverGrid
                  items={playlistsFeaturing.map((p) => ({
                    id: p._id,
                    href: `/playlist/${p._id}`,
                    coverUrl: p.coverUrl,
                    title: p.title,
                    subtitle: `${p.songsCount} titres`,
                  }))}
                  moreLabel="Voir plus de playlists"
                />
              )}
            </div>
          )}

          {tab === "videos" && (
            <div className="rounded-xl2 border border-dashed border-border p-8 text-center">
              <Clapperboard size={28} className="mx-auto mb-3 text-ink-muted" />
              <p className="text-sm font-medium">Vidéos bientôt disponibles</p>
              <p className="mt-1 text-xs text-ink-muted">Cette section arrivera dans une prochaine mise à jour de Moziik.</p>
            </div>
          )}

          {tab === "apropos" && (
            <div className="max-w-2xl space-y-6">
              {isOwnProfile && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-medium text-ink-muted hover:border-accent hover:text-accent"
                >
                  <Pencil size={13} /> Modifier le profil
                </button>
              )}

              <div>
                <h2 className="mb-2 text-sm font-medium">Biographie</h2>
                <p className="selectionnable whitespace-pre-line text-sm text-ink-muted">{artist.bio || "Cet artiste n'a pas encore renseigné de biographie."}</p>
              </div>

              {artist.genres.length > 0 && (
                <div>
                  <h2 className="mb-2 text-sm font-medium">Genres</h2>
                  <div className="flex flex-wrap gap-2">
                    {artist.genres.map((genre) => (
                      <span key={genre} className="rounded-full border border-border px-3 py-1 text-xs text-ink-muted">
                        {genre}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {artist.socialLinks.length > 0 && (
                <div>
                  <h2 className="mb-2 text-sm font-medium">Réseaux sociaux</h2>
                  <div className="flex gap-3">
                    {artist.socialLinks.map((link, i) => {
                      const Icon = SOCIAL_ICON[link.platform] ?? Globe;
                      return (
                        <a
                          key={i}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="grid h-9 w-9 place-items-center rounded-full border border-border text-ink-muted hover:border-accent hover:text-accent"
                        >
                          <Icon size={15} />
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <h2 className="mb-2 text-sm font-medium">Statistiques</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-border p-3 text-center">
                    <p className="text-lg font-display">{formatCompact(artist.totalPlays)}</p>
                    <p className="text-[11px] text-ink-muted">Écoutes</p>
                  </div>
                  <div className="rounded-xl border border-border p-3 text-center">
                    <p className="text-lg font-display">{formatCompact(artist.totalLikes)}</p>
                    <p className="text-[11px] text-ink-muted">Likes</p>
                  </div>
                  <div className="rounded-xl border border-border p-3 text-center">
                    <p className="text-lg font-display">{artist.songsCount}</p>
                    <p className="text-[11px] text-ink-muted">Morceaux</p>
                  </div>
                  <div className="rounded-xl border border-border p-3 text-center">
                    <p className="text-lg font-display">{artist.albumsCount}</p>
                    <p className="text-[11px] text-ink-muted">Albums</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showShareModal && (
        <ShareModal
          subject={buildArtistSubject({ ...artist, songsCount: artist.songsCount, albumsCount: artist.albumsCount }, isOwnProfile)}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {showEditModal && (
        <EditArtistProfileModal
          bio={artist.bio}
          genres={artist.genres}
          socialLinks={artist.socialLinks}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) => setData((prev) => (prev ? { ...prev, artist: { ...prev.artist, ...updated } } : prev))}
        />
      )}

      {/* Sections éditoriales pilotées depuis l'administration. */}
      <PageSections page="detail" className="mt-12 px-6 md:px-10" />

      {menuPosition && (
        <ArtistContextMenu
          artist={artist}
          songs={songs}
          position={menuPosition}
          isOwnProfile={isOwnProfile}
          following={following}
          onToggleFollow={toggleFollow}
          onClose={() => setMenuPosition(null)}
        />
      )}
    </div>
  );
}
