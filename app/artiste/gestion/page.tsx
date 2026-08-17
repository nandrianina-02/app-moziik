"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Music,
  Disc3,
  Users2,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  BadgeCheck,
  Play,
  Pause,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  LayoutList,
  LayoutGrid,
  Headphones,
  Heart,
  Share2,
  Settings2,
  Wallet,
  BarChart3,
  UploadCloud,
  MoreVertical,
  AlertTriangle,
  Inbox,
} from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { Skeleton, SkeletonRows } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CreateAlbumModal } from "@/components/modals/CreateAlbumModal";
import { EditArtistProfileModal } from "@/components/artist/EditArtistProfileModal";
import { SongContextMenu } from "@/components/music/SongContextMenu";
import { usePlayer, type PlayableSong } from "@/context/PlayerProvider";
import { useToast } from "@/context/ToastProvider";
import { formatCompactNumber } from "@/lib/formatNumber";

// ---------------------------------------------------------------------------
// Types — superset de PlayableSong : l'API /api/artist/me/songs renvoie déjà
// le document complet (statut, genre, durée, compteurs...), on se contente
// d'en tirer parti côté UI, sans toucher à la route.
// ---------------------------------------------------------------------------

type OwnSong = PlayableSong & {
  status: "draft" | "scheduled" | "published" | "rejected";
  genre?: string;
  releaseDate?: string;
  sharesCount?: number;
};

type OwnAlbum = { _id: string; title: string; coverUrl: string; type: string; songs: string[] };

type FeaturingSong = {
  _id: string;
  title: string;
  coverUrl: string;
  confirmed: boolean;
  artist: { stageName: string; verified?: boolean } | null;
};

type ArtistDoc = {
  _id: string;
  stageName: string;
  coverUrl?: string;
  bio?: string;
  genres: string[];
  socialLinks: { platform: string; url: string }[];
  verified: boolean;
  followers: string[];
  totalPlays: number;
};

const statusMeta: Record<OwnSong["status"], { label: string; dot: string; text: string; bg: string }> = {
  draft: { label: "Brouillon", dot: "bg-ink-muted", text: "text-ink-muted", bg: "bg-ink-muted/10" },
  scheduled: { label: "Planifié", dot: "bg-blue-500", text: "text-blue-500", bg: "bg-blue-500/10" },
  published: { label: "Publié", dot: "bg-verified", text: "text-verified", bg: "bg-verified/10" },
  rejected: { label: "Refusé", dot: "bg-red-500", text: "text-red-500", bg: "bg-red-500/10" },
};

type CategoryFilter = "all" | "published" | "draft" | "album" | "single" | "featuring";
const categoryFilters: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "published", label: "Publiés" },
  { value: "draft", label: "Brouillons" },
  { value: "album", label: "Albums" },
  { value: "single", label: "Singles" },
  { value: "featuring", label: "Collaborations" },
];

type SortKey = "date" | "plays" | "likes" | "shares" | "title";
const sortOptions: { value: SortKey; label: string }[] = [
  { value: "date", label: "Date" },
  { value: "plays", label: "Écoutes" },
  { value: "likes", label: "Likes" },
  { value: "shares", label: "Partages" },
  { value: "title", label: "Titre" },
];

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ArtistManagementPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pushToast = useToast();

  const [tab, setTab] = useState<"songs" | "albums" | "featurings">("songs");
  const [artist, setArtist] = useState<ArtistDoc | null>(null);
  const [songs, setSongs] = useState<OwnSong[]>([]);
  const [albums, setAlbums] = useState<OwnAlbum[]>([]);
  const [featurings, setFeaturings] = useState<FeaturingSong[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OwnSong | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [menuState, setMenuState] = useState<{ song: OwnSong; x: number; y: number } | null>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const { currentSong, isPlaying, playQueue, togglePlay } = usePlayer();

  const loadSongs = useCallback(async () => {
    const res = await fetch("/api/artist/me/songs");
    if (!res.ok) throw new Error("songs");
    setSongs((await res.json()).songs);
  }, []);

  const loadArtistAndAlbums = useCallback(async () => {
    const res = await fetch("/api/artist/me");
    if (!res.ok) throw new Error("artist");
    const { artist: artistDoc } = await res.json();
    if (artistDoc) {
      setArtist(artistDoc);
      const albumsRes = await fetch(`/api/albums?artist=${artistDoc._id}`);
      if (!albumsRes.ok) throw new Error("albums");
      setAlbums((await albumsRes.json()).albums);
    }
  }, []);

  const loadFeaturings = useCallback(async () => {
    const res = await fetch("/api/artist/me/featurings");
    if (!res.ok) throw new Error("featurings");
    setFeaturings((await res.json()).songs);
  }, []);

  const loadAll = useCallback(async () => {
    setLoadError(false);
    try {
      await Promise.all([loadSongs(), loadArtistAndAlbums(), loadFeaturings()]);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [loadSongs, loadArtistAndAlbums, loadFeaturings]);

  useEffect(() => {
    if (status !== "authenticated") {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const confirmDelete = useCallback((song: OwnSong) => {
    setMenuState(null);
    setDeleteTarget(song);
  }, []);

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/songs/${deleteTarget._id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      pushToast("error", "La suppression a échoué.");
      return;
    }
    pushToast("success", "Son supprimé.");
    setSongs((prev) => prev.filter((s) => s._id !== deleteTarget._id));
    setDeleteTarget(null);
  }

  async function respondFeaturing(id: string, decision: "confirm" | "remove") {
    const res = await fetch(`/api/songs/${id}/featuring`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    if (!res.ok) {
      pushToast("error", "L'action a échoué.");
      return;
    }
    pushToast("success", decision === "confirm" ? "Featuring confirmé." : "Featuring retiré.");
    loadFeaturings();
  }

  const handlePlaySong = useCallback(
    (song: OwnSong, queue: OwnSong[], index: number) => {
      if (currentSong?._id === song._id) togglePlay();
      else playQueue(queue, index, { type: "artist", label: artist?.stageName });
    },
    [currentSong, togglePlay, playQueue, artist?.stageName]
  );

  // Statistiques agrégées à partir des données déjà chargées — aucun
  // nouvel appel réseau, uniquement des dérivés calculés côté client.
  const stats = useMemo(() => {
    const likes = songs.reduce((sum, s) => sum + (s.likesCount ?? 0), 0);
    const shares = songs.reduce((sum, s) => sum + (s.sharesCount ?? 0), 0);
    return {
      plays: artist?.totalPlays ?? songs.reduce((sum, s) => sum + (s.playsCount ?? 0), 0),
      likes,
      shares,
      followers: artist?.followers.length ?? 0,
    };
  }, [songs, artist]);

  const statusCounts = useMemo(() => {
    const counts: Record<OwnSong["status"], number> = { published: 0, draft: 0, scheduled: 0, rejected: 0 };
    for (const s of songs) counts[s.status]++;
    return counts;
  }, [songs]);

  const filteredSongs = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = songs.filter((s) => {
      if (term && !s.title.toLowerCase().includes(term) && !(s.genre ?? "").toLowerCase().includes(term)) return false;
      switch (category) {
        case "published":
          return s.status === "published";
        case "draft":
          return s.status === "draft";
        case "album":
          return Boolean(s.album);
        case "single":
          return !s.album;
        case "featuring":
          return (s.featuring?.length ?? 0) > 0;
        default:
          return true;
      }
    });

    const dir = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case "plays":
          return ((a.playsCount ?? 0) - (b.playsCount ?? 0)) * dir;
        case "likes":
          return ((a.likesCount ?? 0) - (b.likesCount ?? 0)) * dir;
        case "shares":
          return ((a.sharesCount ?? 0) - (b.sharesCount ?? 0)) * dir;
        case "title":
          return a.title.localeCompare(b.title) * dir;
        case "date":
        default:
          return (new Date(a.releaseDate ?? 0).getTime() - new Date(b.releaseDate ?? 0).getTime()) * dir;
      }
    });

    return list;
  }, [songs, search, category, sortKey, sortDir]);

  if (status !== "authenticated") {
    return (
      <div className="mx-auto w-full max-w-[1600px] px-6 py-8 md:px-10 md:py-10">
        <p className="text-sm text-ink-muted">Connecte-toi avec ton compte artiste pour accéder à cet espace.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-8 md:px-10 md:py-10">
      {/* En-tête */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <SafeImage
            src={artist?.coverUrl}
            alt={artist?.stageName ?? "Artiste"}
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-full object-cover"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-2xl font-display">Mon espace artiste</h1>
              <span aria-hidden>👋</span>
            </div>
            <p className="flex items-center gap-1 text-sm text-ink-muted">
              Gère ta musique, tes albums et tes collaborations
              {artist?.verified && (
                <span className="ml-1 inline-flex items-center gap-1 text-verified">
                  <BadgeCheck size={13} /> Artiste vérifié
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation secondaire de l'espace artiste */}
      <nav aria-label="Sections de l'espace artiste" className="-mx-6 mb-6 overflow-x-auto px-6 md:-mx-10 md:px-10">
        <div className="flex w-max items-center gap-2">
          <div role="tablist" aria-label="Contenu principal" className="flex items-center gap-2">
            <SecondaryNavButton icon={Music} label="Mes sons" active={tab === "songs"} onClick={() => setTab("songs")} />
            <SecondaryNavButton icon={Disc3} label="Mes albums" active={tab === "albums"} onClick={() => setTab("albums")} />
            <SecondaryNavButton icon={Users2} label="Collaborations" active={tab === "featurings"} onClick={() => setTab("featurings")} />
          </div>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <Link
            href="/artiste/revenus"
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-ink"
          >
            <Wallet size={14} /> Revenus
          </Link>
          <button
            onClick={() => setShowEditProfile(true)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-ink"
          >
            <Settings2 size={14} /> Paramètres
          </button>
          <span
            title="Bientôt disponible"
            className="flex cursor-not-allowed items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-ink-muted/50"
          >
            <BarChart3 size={14} /> Statistiques
          </span>
        </div>
      </nav>

      {loading && (
        <div aria-busy="true" className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl2" />
            ))}
          </div>
          <SkeletonRows count={6} />
        </div>
      )}

      {!loading && loadError && (
        <div className="flex flex-col items-center gap-3 rounded-xl2 border border-border bg-surface py-16 text-center">
          <AlertTriangle size={26} className="text-accent" />
          <p className="text-sm text-ink-muted">Une erreur est survenue pendant le chargement.</p>
          <button
            onClick={() => {
              setLoading(true);
              loadAll();
            }}
            className="rounded-full border border-accent px-4 py-1.5 text-sm font-medium text-accent hover:bg-accent/10"
          >
            Réessayer
          </button>
        </div>
      )}

      {!loading && !loadError && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* Colonne principale */}
          <div className="min-w-0">
            {/* Barre d'actions */}
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {tab === "songs" && (
                <>
                  <button
                    onClick={() => router.push("/son/nouveau")}
                    className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
                  >
                    <Plus size={16} /> Publier un son
                  </button>
                  <button
                    title="Bientôt disponible"
                    disabled
                    className="flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-sm font-medium text-ink-muted/50"
                  >
                    <UploadCloud size={15} /> Importer plusieurs morceaux
                  </button>
                </>
              )}
              {tab === "albums" && (
                <button
                  onClick={() => setShowCreateAlbum(true)}
                  className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
                >
                  <Plus size={16} /> Créer un album
                </button>
              )}

              {tab === "songs" && (
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <label className="relative">
                    <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Rechercher un son..."
                      aria-label="Rechercher un son"
                      className="w-44 rounded-full border border-border bg-surface py-2 pl-8 pr-3 text-xs outline-none focus:border-accent sm:w-56"
                    />
                  </label>

                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowFilterMenu((v) => !v);
                        setShowSortMenu(false);
                      }}
                      aria-haspopup="true"
                      aria-expanded={showFilterMenu}
                      className="flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-ink"
                    >
                      <SlidersHorizontal size={13} />
                      {categoryFilters.find((f) => f.value === category)?.label}
                    </button>
                    {showFilterMenu && (
                      <div className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-border bg-surface p-1.5 shadow-2xl">
                        {categoryFilters.map((f) => (
                          <button
                            key={f.value}
                            onClick={() => {
                              setCategory(f.value);
                              setShowFilterMenu(false);
                            }}
                            className={`flex w-full items-center rounded-lg px-3 py-1.5 text-left text-xs transition-colors hover:bg-base ${
                              category === f.value ? "font-medium text-accent" : "text-ink-muted"
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowSortMenu((v) => !v);
                        setShowFilterMenu(false);
                      }}
                      aria-haspopup="true"
                      aria-expanded={showSortMenu}
                      className="flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-ink"
                    >
                      <ArrowUpDown size={13} />
                      {sortOptions.find((s) => s.value === sortKey)?.label}
                    </button>
                    {showSortMenu && (
                      <div className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-border bg-surface p-1.5 shadow-2xl">
                        {sortOptions.map((s) => (
                          <button
                            key={s.value}
                            onClick={() => {
                              if (sortKey === s.value) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                              else {
                                setSortKey(s.value);
                                setSortDir("desc");
                              }
                              setShowSortMenu(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs transition-colors hover:bg-base ${
                              sortKey === s.value ? "font-medium text-accent" : "text-ink-muted"
                            }`}
                          >
                            {s.label}
                            {sortKey === s.value && <span aria-hidden>{sortDir === "asc" ? "↑" : "↓"}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div role="group" aria-label="Mode d'affichage" className="flex items-center rounded-full border border-border p-0.5">
                    <button
                      onClick={() => setViewMode("list")}
                      aria-pressed={viewMode === "list"}
                      aria-label="Affichage en liste"
                      className={`grid h-7 w-7 place-items-center rounded-full transition-colors ${
                        viewMode === "list" ? "bg-accent text-base" : "text-ink-muted"
                      }`}
                    >
                      <LayoutList size={13} />
                    </button>
                    <button
                      onClick={() => setViewMode("grid")}
                      aria-pressed={viewMode === "grid"}
                      aria-label="Affichage en grille"
                      className={`grid h-7 w-7 place-items-center rounded-full transition-colors ${
                        viewMode === "grid" ? "bg-accent text-base" : "text-ink-muted"
                      }`}
                    >
                      <LayoutGrid size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {tab === "songs" && (
              <SongsPanel
                songs={filteredSongs}
                totalCount={songs.length}
                hasSearch={search.trim().length > 0 || category !== "all"}
                viewMode={viewMode}
                onPlay={handlePlaySong}
                onOpenMenu={(song, x, y) => setMenuState({ song, x, y })}
                onDelete={confirmDelete}
              />
            )}

            {tab === "albums" && (
              <div>
                {albums.length === 0 ? (
                  <EmptyState icon={Disc3} message="Pas encore d'album." />
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {albums.map((album) => (
                      <Link key={album._id} href={`/album/${album._id}`} className="group">
                        <SafeImage
                          src={album.coverUrl}
                          alt={album.title}
                          width={140}
                          height={140}
                          className="mb-2 aspect-square w-full rounded-xl2 object-cover transition-transform group-hover:scale-[1.02]"
                        />
                        <p className="truncate text-sm">{album.title}</p>
                        <p className="text-xs text-ink-muted">{album.songs.length} son(s)</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "featurings" && (
              <div className="space-y-2">
                {featurings.length === 0 ? (
                  <EmptyState icon={Users2} message="Aucun featuring pour l'instant." />
                ) : (
                  featurings.map((song) => (
                    <div key={song._id} className="flex items-center gap-3 rounded-xl2 border border-border bg-surface px-4 py-3">
                      <SafeImage src={song.coverUrl} alt={song.title} width={40} height={40} className="shrink-0 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{song.title}</p>
                        <p className="flex items-center gap-1 truncate text-xs text-ink-muted">
                          {song.artist?.stageName ?? "Artiste supprimé"}
                          {song.artist?.verified && <BadgeCheck size={11} className="shrink-0 text-verified" />}
                          {" · "}
                          {song.confirmed ? "Confirmé" : "En attente de ta confirmation"}
                        </p>
                      </div>
                      {!song.confirmed && (
                        <button
                          onClick={() => respondFeaturing(song._id, "confirm")}
                          aria-label="Confirmer"
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-verified text-verified hover:bg-verified/10"
                        >
                          <Check size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => respondFeaturing(song._id, "remove")}
                        aria-label="Retirer ce crédit"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-accent text-accent hover:bg-accent/10"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Colonne de droite : aperçu, statut, actions rapides */}
          <aside className="flex flex-col gap-5">
            <div className="rounded-xl2 border border-border bg-surface p-5">
              <p className="mb-4 text-sm font-semibold">Aperçu rapide</p>
              <div className="grid grid-cols-2 gap-3">
                <StatTile icon={Headphones} label="Écoutes" value={stats.plays} />
                <StatTile icon={Heart} label="Likes" value={stats.likes} />
                <StatTile icon={Share2} label="Partages" value={stats.shares} />
                <StatTile icon={Users2} label="Abonnés" value={stats.followers} />
              </div>
            </div>

            <div className="rounded-xl2 border border-border bg-surface p-5">
              <p className="mb-4 text-sm font-semibold">Statut de vos sons</p>
              <StatusDonut counts={statusCounts} />
            </div>

            <div className="rounded-xl2 border border-border bg-surface p-5">
              <p className="mb-3 text-sm font-semibold">Actions rapides</p>
              <div className="flex flex-col gap-1">
                <QuickAction icon={Plus} label="Publier un son" description="Partagez votre musique avec le monde" onClick={() => router.push("/son/nouveau")} />
                <QuickAction icon={Disc3} label="Créer un album" description="Regroupez vos sons" onClick={() => setShowCreateAlbum(true)} />
                <QuickAction icon={Wallet} label="Gérer mes revenus" description="Suivez vos gains et paiements" href="/artiste/revenus" />
                <QuickAction icon={Settings2} label="Modifier le profil" description="Bio, genres, réseaux sociaux" onClick={() => setShowEditProfile(true)} />
              </div>
            </div>
          </aside>
        </div>
      )}

      {showCreateAlbum && <CreateAlbumModal onClose={() => setShowCreateAlbum(false)} onCreated={loadArtistAndAlbums} />}
      {showEditProfile && artist && (
        <EditArtistProfileModal
          bio={artist.bio}
          genres={artist.genres}
          socialLinks={artist.socialLinks}
          onClose={() => setShowEditProfile(false)}
          onSaved={(data) => setArtist((prev) => (prev ? { ...prev, ...data } : prev))}
        />
      )}

      {menuState && (
        <SongContextMenu
          song={menuState.song}
          position={{ x: menuState.x, y: menuState.y }}
          canManage={session?.user?.role === "admin" || session?.user?.id === menuState.song.artist?._id}
          onClose={() => setMenuState(null)}
          onDeleted={() => setSongs((prev) => prev.filter((s) => s._id !== menuState.song._id))}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Supprimer « ${deleteTarget.title} » ?`}
          description="Cette action est irréversible : le son sera définitivement supprimé de ton catalogue."
          confirmLabel="Supprimer"
          busy={deleting}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------------------

function SecondaryNavButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Music;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
        active ? "border-accent bg-accent text-base" : "border-border text-ink-muted hover:border-accent hover:text-ink"
      }`}
    >
      <Icon size={14} /> {label}
    </button>
  );
}

function StatTile({ icon: Icon, label, value }: { icon: typeof Headphones; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <Icon size={16} className="mb-2 text-accent" />
      <p className="text-base font-semibold">{formatCompactNumber(value)}</p>
      <p className="text-[11px] text-ink-muted">{label}</p>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  description,
  onClick,
  href,
}: {
  icon: typeof Plus;
  label: string;
  description: string;
  onClick?: () => void;
  href?: string;
}) {
  const content = (
    <>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
        <Icon size={16} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-ink-muted">{description}</span>
      </span>
    </>
  );
  const className = "flex items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-base";
  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function StatusDonut({ counts }: { counts: Record<OwnSong["status"], number> }) {
  const total = counts.published + counts.draft + counts.scheduled + counts.rejected;
  const segments: { key: OwnSong["status"]; color: string }[] = [
    { key: "published", color: "#3DDC97" },
    { key: "draft", color: "#8B8FA3" },
    { key: "scheduled", color: "#3B82F6" },
    { key: "rejected", color: "#EF4444" },
  ];

  const circumference = 2 * Math.PI * 40;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 100 100" width={104} height={104} className="shrink-0 -rotate-90" role="img" aria-label="Répartition des morceaux par statut">
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className="text-border" strokeWidth="12" />
        {total > 0 &&
          segments.map((seg) => {
            const count = counts[seg.key];
            if (count === 0) return null;
            const length = (count / total) * circumference;
            const dasharray = `${length} ${circumference - length}`;
            const el = (
              <circle
                key={seg.key}
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={seg.color}
                strokeWidth="12"
                strokeDasharray={dasharray}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += length;
            return el;
          })}
        <circle cx="50" cy="50" r="40" fill="none" />
      </svg>
      <ul className="flex flex-col gap-1.5 text-xs">
        {segments.map((seg) => (
          <li key={seg.key} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: seg.color }} aria-hidden />
            <span className="text-ink-muted">{statusMeta[seg.key].label}</span>
            <span className="font-medium">{counts[seg.key]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: typeof Inbox; message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl2 border border-dashed border-border py-14 text-center">
      <Icon size={26} className="text-ink-muted" />
      <p className="text-sm text-ink-muted">{message}</p>
    </div>
  );
}

function SongsPanel({
  songs,
  totalCount,
  hasSearch,
  viewMode,
  onPlay,
  onOpenMenu,
  onDelete,
}: {
  songs: OwnSong[];
  totalCount: number;
  hasSearch: boolean;
  viewMode: "list" | "grid";
  onPlay: (song: OwnSong, queue: OwnSong[], index: number) => void;
  onOpenMenu: (song: OwnSong, x: number, y: number) => void;
  onDelete: (song: OwnSong) => void;
}) {
  if (totalCount === 0) {
    return <EmptyState icon={Inbox} message="Tu n'as encore publié aucun son." />;
  }
  if (songs.length === 0) {
    return <EmptyState icon={Search} message={hasSearch ? "Aucun résultat pour cette recherche/filtre." : "Aucun morceau."} />;
  }

  if (viewMode === "grid") {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {songs.map((song, i) => (
          <SongGridCard key={song._id} song={song} onPlay={() => onPlay(song, songs, i)} onOpenMenu={(x, y) => onOpenMenu(song, x, y)} />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Tableau — desktop / tablette */}
      <div className="hidden overflow-x-auto rounded-xl2 border border-border bg-surface sm:block">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-ink-muted">
              <th scope="col" className="w-10 py-3 pl-4"><span className="sr-only">Lecture</span></th>
              <th scope="col" className="py-3 pr-3">Titre</th>
              <th scope="col" className="py-3 pr-3">Genre</th>
              <th scope="col" className="py-3 pr-3">Durée</th>
              <th scope="col" className="py-3 pr-3">Statut</th>
              <th scope="col" className="py-3 pr-3">Écoutes</th>
              <th scope="col" className="py-3 pr-3">Likes</th>
              <th scope="col" className="py-3 pr-3">Partages</th>
              <th scope="col" className="py-3 pr-3">Date</th>
              <th scope="col" className="w-28 py-3 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {songs.map((song, i) => (
              <SongTableRow key={song._id} song={song} onPlay={() => onPlay(song, songs, i)} onOpenMenu={(x, y) => onOpenMenu(song, x, y)} onDelete={() => onDelete(song)} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Cartes verticales — mobile */}
      <div className="flex flex-col gap-3 sm:hidden">
        {songs.map((song, i) => (
          <SongMobileCard key={song._id} song={song} onPlay={() => onPlay(song, songs, i)} onOpenMenu={(x, y) => onOpenMenu(song, x, y)} onDelete={() => onDelete(song)} />
        ))}
      </div>
    </>
  );
}

const SongTableRow = memo(function SongTableRow({
  song,
  onPlay,
  onOpenMenu,
  onDelete,
}: {
  song: OwnSong;
  onPlay: () => void;
  onOpenMenu: (x: number, y: number) => void;
  onDelete: () => void;
}) {
  const { currentSong, isPlaying } = usePlayer();
  const isCurrent = currentSong?._id === song._id;
  const meta = statusMeta[song.status];

  return (
    <tr className="group border-b border-border last:border-0 transition-colors hover:bg-base/60">
      <td className="py-2.5 pl-4">
        <button
          onClick={onPlay}
          aria-label={isCurrent && isPlaying ? "Mettre en pause" : `Lire ${song.title}`}
          className="grid h-8 w-8 place-items-center rounded-full text-ink-muted transition-colors hover:bg-accent/10 hover:text-accent"
        >
          {isCurrent && isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
        </button>
      </td>
      <td className="py-2.5 pr-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <SafeImage src={song.coverUrl} alt={song.title} width={36} height={36} className="shrink-0 rounded-lg object-cover" />
          <span className={`truncate ${isCurrent ? "text-accent" : ""}`}>{song.title}</span>
        </div>
      </td>
      <td className="py-2.5 pr-3 text-ink-muted">{song.genre ?? "—"}</td>
      <td className="py-2.5 pr-3 text-ink-muted">{formatDuration(song.duration)}</td>
      <td className="py-2.5 pr-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.bg} ${meta.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden /> {meta.label}
        </span>
      </td>
      <td className="py-2.5 pr-3 text-ink-muted">{formatCompactNumber(song.playsCount ?? 0)}</td>
      <td className="py-2.5 pr-3 text-ink-muted">{formatCompactNumber(song.likesCount ?? 0)}</td>
      <td className="py-2.5 pr-3 text-ink-muted">{formatCompactNumber(song.sharesCount ?? 0)}</td>
      <td className="py-2.5 pr-3 whitespace-nowrap text-ink-muted">{formatDate(song.releaseDate)}</td>
      <td className="py-2.5 pr-4">
        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <Link href={`/son/${song._id}/modifier`} aria-label={`Modifier ${song.title}`} className="rounded-lg p-1.5 text-ink-muted hover:bg-base hover:text-accent">
            <Pencil size={14} />
          </Link>
          <Link href={`/son/${song._id}`} aria-label={`Voir ${song.title}`} className="rounded-lg p-1.5 text-ink-muted hover:bg-base hover:text-accent">
            <Play size={14} />
          </Link>
          <button onClick={onDelete} aria-label={`Supprimer ${song.title}`} className="rounded-lg p-1.5 text-ink-muted hover:bg-base hover:text-accent">
            <Trash2 size={14} />
          </button>
          <button
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              onOpenMenu(rect.right, rect.bottom + 4);
            }}
            aria-label={`Plus d'options pour ${song.title}`}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-base hover:text-accent"
          >
            <MoreVertical size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
});

const SongMobileCard = memo(function SongMobileCard({
  song,
  onPlay,
  onOpenMenu,
  onDelete,
}: {
  song: OwnSong;
  onPlay: () => void;
  onOpenMenu: (x: number, y: number) => void;
  onDelete: () => void;
}) {
  const { currentSong, isPlaying } = usePlayer();
  const isCurrent = currentSong?._id === song._id;
  const meta = statusMeta[song.status];

  return (
    <div className="rounded-xl2 border border-border bg-surface p-3.5">
      <div className="flex items-center gap-3">
        <SafeImage src={song.coverUrl} alt={song.title} width={48} height={48} className="shrink-0 rounded-xl object-cover" />
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-medium ${isCurrent ? "text-accent" : ""}`}>{song.title}</p>
          <p className="truncate text-xs text-ink-muted">
            {song.genre ?? "—"} · {formatDuration(song.duration)}
          </p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.bg} ${meta.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden /> {meta.label}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-ink-muted">
        <span className="flex items-center gap-1">
          <Headphones size={12} /> {formatCompactNumber(song.playsCount ?? 0)}
        </span>
        <span className="flex items-center gap-1">
          <Heart size={12} /> {formatCompactNumber(song.likesCount ?? 0)}
        </span>
        <span className="flex items-center gap-1">
          <Share2 size={12} /> {formatCompactNumber(song.sharesCount ?? 0)}
        </span>
        <span className="ml-auto">{formatDate(song.releaseDate)}</span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        <button
          onClick={onPlay}
          aria-label={isCurrent && isPlaying ? "Mettre en pause" : `Lire ${song.title}`}
          className="flex items-center justify-center gap-1 rounded-lg bg-accent py-2 text-xs font-medium text-base"
        >
          {isCurrent && isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
        </button>
        <Link
          href={`/son/${song._id}/modifier`}
          aria-label={`Modifier ${song.title}`}
          className="flex items-center justify-center rounded-lg border border-border py-2 text-ink-muted"
        >
          <Pencil size={13} />
        </Link>
        <button onClick={onDelete} aria-label={`Supprimer ${song.title}`} className="flex items-center justify-center rounded-lg border border-border py-2 text-ink-muted">
          <Trash2 size={13} />
        </button>
        <button
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            onOpenMenu(rect.right, rect.bottom + 4);
          }}
          aria-label={`Plus d'options pour ${song.title}`}
          className="flex items-center justify-center rounded-lg border border-border py-2 text-ink-muted"
        >
          <MoreVertical size={13} />
        </button>
      </div>
    </div>
  );
});

const SongGridCard = memo(function SongGridCard({
  song,
  onPlay,
  onOpenMenu,
}: {
  song: OwnSong;
  onPlay: () => void;
  onOpenMenu: (x: number, y: number) => void;
}) {
  const { currentSong, isPlaying } = usePlayer();
  const isCurrent = currentSong?._id === song._id;
  const meta = statusMeta[song.status];

  return (
    <div className="group relative rounded-xl2 border border-border bg-surface p-3 transition-shadow hover:shadow-lg">
      <div className="relative mb-2.5">
        <SafeImage src={song.coverUrl} alt={song.title} width={160} height={160} className="aspect-square w-full rounded-xl object-cover" />
        <button
          onClick={onPlay}
          aria-label={isCurrent && isPlaying ? "Mettre en pause" : `Lire ${song.title}`}
          className="absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full bg-accent text-base opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
        >
          {isCurrent && isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
        </button>
      </div>
      <p className={`truncate text-sm ${isCurrent ? "text-accent" : ""}`}>{song.title}</p>
      <div className="mt-1 flex items-center justify-between">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.bg} ${meta.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden /> {meta.label}
        </span>
        <button
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            onOpenMenu(rect.right, rect.bottom + 4);
          }}
          aria-label={`Plus d'options pour ${song.title}`}
          className="rounded-lg p-1 text-ink-muted hover:text-accent"
        >
          <MoreVertical size={14} />
        </button>
      </div>
    </div>
  );
});
