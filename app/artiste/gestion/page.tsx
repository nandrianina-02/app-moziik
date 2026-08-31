"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
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
  ChevronDown,
  ChevronRight,
  LayoutList,
  LayoutGrid,
  Headphones,
  Heart,
  Share2,
  Settings2,
  Wallet,
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
  scheduled: { label: "Planifié", dot: "bg-tint-blue", text: "text-tint-blue", bg: "bg-tint-blue/10" },
  published: { label: "Publié", dot: "bg-verified", text: "text-verified", bg: "bg-verified/10" },
  rejected: { label: "Refusé", dot: "bg-danger", text: "text-danger", bg: "bg-danger/10" },
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

// La liste des sons s'ouvre sur un aperçu court, puis se déroule par
// paliers via « Voir plus de sons » — sur un téléphone, cinq lignes
// laissent atteindre les cartes de synthèse sans traverser tout le
// catalogue au doigt.
const SONGS_PAGE_SIZE = 5;
const SONGS_PAGE_STEP = 10;

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
  const [visibleCount, setVisibleCount] = useState(SONGS_PAGE_SIZE);

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

  // Tout changement de recherche, de filtre ou de tri replie la liste :
  // sans cela, « Voir plus » resterait déroulé sur un résultat qui n'a
  // plus rien à voir avec celui qu'on venait d'ouvrir.
  useEffect(() => {
    setVisibleCount(SONGS_PAGE_SIZE);
  }, [search, category, sortKey, sortDir, tab]);

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
      else playQueue(queue, index, { type: "artist", label: artist?.stageName, id: artist?._id });
    },
    [currentSong, togglePlay, playQueue, artist?.stageName, artist?._id]
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
      <div className="mb-6 flex items-center gap-4 sm:gap-5">
        <SafeImage
          src={artist?.coverUrl}
          alt={artist?.stageName ?? "Artiste"}
          width={96}
          height={96}
          className="h-[72px] w-[72px] shrink-0 rounded-full object-cover sm:h-24 sm:w-24"
        />
        <div className="min-w-0">
          <h1 className="text-2xl font-display sm:text-3xl">Mon espace artiste</h1>
          <p className="mt-1 text-sm text-ink-muted">Gère ta musique, tes albums et tes collaborations</p>
          {artist?.verified && (
            <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-verified">
              <BadgeCheck size={14} /> Artiste vérifié
            </span>
          )}
        </div>
      </div>

      {/* Navigation secondaire de l'espace artiste — les cinq entrées ont
          désormais la même forme : rien ne distingue plus « Revenus » et
          « Paramètres » du reste, alors qu'ils mènent au même niveau de
          l'espace artiste. */}
      <nav aria-label="Sections de l'espace artiste" className="-mx-6 mb-5 overflow-x-auto px-6 pb-1 md:-mx-10 md:px-10">
        <div className="flex w-max items-center gap-2.5">
          <div role="tablist" aria-label="Contenu principal" className="flex items-center gap-2.5">
            <SecondaryNavButton label="Mes sons" active={tab === "songs"} onClick={() => setTab("songs")} />
            <SecondaryNavButton label="Mes albums" active={tab === "albums"} onClick={() => setTab("albums")} />
            <SecondaryNavButton label="Collaborations" active={tab === "featurings"} onClick={() => setTab("featurings")} />
          </div>
          <Link href="/artiste/revenus" className={navPillClass(false)}>
            Revenus
          </Link>
          <button onClick={() => setShowEditProfile(true)} className={navPillClass(false)}>
            Paramètres
          </button>
          {/* aria-disabled plutôt qu'un simple gris : c'est ce qui dit aux
              lecteurs d'écran que l'entrée est inactive. À 50 % d'encre
              atténuée le libellé tombait à 2,2:1, illisible dans les deux
              thèmes — 70 % reste estompé sans devenir indéchiffrable. */}
          <span
            title="Bientôt disponible"
            aria-disabled="true"
            className="flex cursor-not-allowed items-center whitespace-nowrap rounded-2xl border border-border px-4 py-2.5 text-sm font-medium text-ink-muted/70"
          >
            Statistiques
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
            {/* Barre d'actions — empilée sur toute la largeur : sur un
                téléphone, « Publier un son » est l'action de la page, elle
                mérite la pleine mesure plutôt qu'un coin de ligne. */}
            {tab === "songs" && (
              <div className="mb-5 flex flex-col gap-3">
                <button
                  onClick={() => router.push("/son/nouveau")}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3.5 text-sm font-semibold text-base transition-colors hover:bg-accent-hover sm:w-auto sm:self-start"
                >
                  <Plus size={18} /> Publier un son
                </button>

                {/* L'import groupé existe désormais, mais reste réservé à
                    l'administration : l'entrée n'est active que pour elle. */}
                {session?.user?.role === "admin" ? (
                  <Link
                    href="/admin/import"
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border px-5 py-3 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent sm:w-auto sm:self-start"
                  >
                    <UploadCloud size={17} /> Importer plusieurs morceaux
                  </Link>
                ) : (
                  <button
                    title="Bientôt disponible"
                    disabled
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border px-5 py-3 text-sm font-medium text-ink-muted/70 sm:w-auto sm:self-start"
                  >
                    <UploadCloud size={17} /> Importer plusieurs morceaux
                  </button>
                )}

                <label className="relative block">
                  <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher un son..."
                    aria-label="Rechercher un son"
                    className="w-full rounded-2xl border border-border bg-surface py-3 pl-11 pr-4 text-sm outline-none focus:border-accent"
                  />
                </label>

                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowFilterMenu((v) => !v);
                        setShowSortMenu(false);
                      }}
                      aria-haspopup="true"
                      aria-expanded={showFilterMenu}
                      className="flex items-center gap-2 rounded-2xl border border-border px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-accent"
                    >
                      {categoryFilters.find((f) => f.value === category)?.label}
                      <ChevronDown size={15} className="text-ink-muted" />
                    </button>
                    {showFilterMenu && (
                      <div className="absolute left-0 top-12 z-20 w-44 rounded-xl border border-border bg-surface p-1.5 shadow-2xl">
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
                      className="flex items-center gap-2 rounded-2xl border border-border px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-accent"
                    >
                      {sortOptions.find((s) => s.value === sortKey)?.label}
                      <ChevronDown size={15} className="text-ink-muted" />
                    </button>
                    {showSortMenu && (
                      <div className="absolute left-0 top-12 z-20 w-44 rounded-xl border border-border bg-surface p-1.5 shadow-2xl">
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

                  <div role="group" aria-label="Mode d'affichage" className="ml-auto flex items-center rounded-2xl border border-border p-1">
                    <button
                      onClick={() => setViewMode("list")}
                      aria-pressed={viewMode === "list"}
                      aria-label="Affichage en liste"
                      className={`grid h-8 w-8 place-items-center rounded-xl transition-colors ${
                        viewMode === "list" ? "bg-accent text-base" : "text-ink-muted"
                      }`}
                    >
                      <LayoutList size={15} />
                    </button>
                    <button
                      onClick={() => setViewMode("grid")}
                      aria-pressed={viewMode === "grid"}
                      aria-label="Affichage en grille"
                      className={`grid h-8 w-8 place-items-center rounded-xl transition-colors ${
                        viewMode === "grid" ? "bg-accent text-base" : "text-ink-muted"
                      }`}
                    >
                      <LayoutGrid size={15} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {tab === "albums" && (
              <button
                onClick={() => setShowCreateAlbum(true)}
                className="mb-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3.5 text-sm font-semibold text-base transition-colors hover:bg-accent-hover sm:w-auto"
              >
                <Plus size={18} /> Créer un album
              </button>
            )}

            {tab === "songs" && (
              <SongsPanel
                songs={filteredSongs}
                totalCount={songs.length}
                hasSearch={search.trim().length > 0 || category !== "all"}
                viewMode={viewMode}
                visibleCount={visibleCount}
                onShowMore={() => setVisibleCount((n) => n + SONGS_PAGE_STEP)}
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
              <div className="grid grid-cols-4 gap-2.5 xl:grid-cols-2 xl:gap-3">
                <StatTile icon={Headphones} label="Écoutes" value={stats.plays} />
                <StatTile icon={Heart} label="Likes" value={stats.likes} accent />
                <StatTile icon={Share2} label="Partages" value={stats.shares} />
                <StatTile icon={Users2} label="Abonnés" value={stats.followers} />
              </div>
            </div>

            <div className="rounded-xl2 border border-border bg-surface p-5">
              <p className="mb-4 text-sm font-semibold">Statut de vos sons</p>
              <StatusDonut counts={statusCounts} />
            </div>

            <div className="rounded-xl2 border border-border bg-surface p-5">
              <p className="mb-1 text-sm font-semibold">Actions rapides</p>
              <div className="flex flex-col">
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

// La forme des entrées de navigation est partagée par les trois onglets,
// le lien « Revenus » et le bouton « Paramètres » : trois éléments HTML
// différents pour une seule et même rangée, d'où la classe extraite.
function navPillClass(active: boolean) {
  return `flex items-center whitespace-nowrap rounded-2xl border px-4 py-2.5 text-sm font-medium transition-colors ${
    active ? "border-accent bg-accent text-base" : "border-border text-ink hover:border-accent hover:text-accent"
  }`;
}

function SecondaryNavButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button role="tab" aria-selected={active} onClick={onClick} className={navPillClass(active)}>
      {label}
    </button>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Headphones;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-border px-1.5 py-3.5 text-center">
      <Icon size={18} className={accent ? "text-accent" : "text-ink"} />
      <p className="text-[11px] leading-tight text-ink-muted">{label}</p>
      <p className="text-lg font-semibold leading-none text-ink">{formatCompactNumber(value)}</p>
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
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
        <Icon size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {/* La description n'apparaît qu'à partir du grand écran : dans la
            colonne étroite d'un téléphone, elle doublait la hauteur de
            chaque rangée pour redire ce que le libellé annonce déjà. */}
        <span className="hidden truncate text-xs text-ink-muted sm:block">{description}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-ink-muted" />
    </>
  );
  const className =
    "flex items-center gap-3 border-b border-border px-1 py-3 text-left transition-colors last:border-0 hover:text-accent";
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
  // Les couleurs des arcs suivent les mêmes variables que les pastilles
  // de statut au-dessus : figées en hexadécimal, elles restaient calées
  // sur le thème sombre.
  const segments: { key: OwnSong["status"]; color: string }[] = [
    { key: "published", color: "rgb(var(--color-verified))" },
    { key: "draft", color: "rgb(var(--color-ink-muted))" },
    { key: "scheduled", color: "rgb(var(--tint-blue))" },
    { key: "rejected", color: "rgb(var(--color-danger))" },
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
      <ul className="flex min-w-0 flex-1 flex-col gap-2 text-xs">
        {segments.map((seg) => (
          <li key={seg.key} className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} aria-hidden />
            <span className="flex-1 truncate text-ink-muted">{statusMeta[seg.key].label}</span>
            <span className="font-semibold">{counts[seg.key]}</span>
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
  visibleCount,
  onShowMore,
  onPlay,
  onOpenMenu,
  onDelete,
}: {
  songs: OwnSong[];
  totalCount: number;
  hasSearch: boolean;
  viewMode: "list" | "grid";
  visibleCount: number;
  onShowMore: () => void;
  onPlay: (song: OwnSong, queue: OwnSong[], index: number) => void;
  onOpenMenu: (song: OwnSong, x: number, y: number) => void;
  onDelete: (song: OwnSong) => void;
}) {
  // On tronque l'affichage, jamais la file de lecture : `onPlay` reçoit
  // toujours la liste filtrée complète, si bien qu'un son lancé depuis
  // l'aperçu enchaîne sur ceux qui ne sont pas encore dépliés.
  const visible = songs.slice(0, visibleCount);
  const hasMore = songs.length > visible.length;

  if (totalCount === 0) {
    return <EmptyState icon={Inbox} message="Tu n'as encore publié aucun son." />;
  }
  if (songs.length === 0) {
    return <EmptyState icon={Search} message={hasSearch ? "Aucun résultat pour cette recherche/filtre." : "Aucun morceau."} />;
  }

  if (viewMode === "grid") {
    return (
      <div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((song, i) => (
            <SongGridCard key={song._id} song={song} onPlay={() => onPlay(song, songs, i)} onOpenMenu={(x, y) => onOpenMenu(song, x, y)} />
          ))}
        </div>
        {hasMore && (
          <div className="mt-4 flex justify-center">
            <ShowMoreButton remaining={songs.length - visible.length} onClick={onShowMore} />
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Tableau — desktop / tablette */}
      <div className="hidden overflow-hidden rounded-xl2 border border-border bg-surface sm:block">
        <div className="overflow-x-auto">
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
              {visible.map((song, i) => (
                <SongTableRow key={song._id} song={song} onPlay={() => onPlay(song, songs, i)} onOpenMenu={(x, y) => onOpenMenu(song, x, y)} onDelete={() => onDelete(song)} />
              ))}
            </tbody>
          </table>
        </div>
        {hasMore && (
          <div className="border-t border-border">
            <ShowMoreButton remaining={songs.length - visible.length} onClick={onShowMore} full />
          </div>
        )}
      </div>

      {/* Liste compacte — mobile. Une seule carte, des rangées séparées par
          un filet : les quatre boutons pleine largeur de l'ancienne fiche
          faisaient trois écrans pour cinq morceaux, alors que le menu
          contextuel (les trois points) porte déjà les mêmes actions. */}
      <div className="overflow-hidden rounded-xl2 border border-border bg-surface sm:hidden">
        {visible.map((song, i) => (
          <SongMobileRow key={song._id} song={song} onPlay={() => onPlay(song, songs, i)} onOpenMenu={(x, y) => onOpenMenu(song, x, y)} />
        ))}
        {/* Pas de filet supplémentaire ici : la dernière rangée visible
            n'est plus l'enfant final, elle garde donc le sien. */}
        {hasMore && <ShowMoreButton remaining={songs.length - visible.length} onClick={onShowMore} full />}
      </div>
    </>
  );
}

function ShowMoreButton({ remaining, onClick, full }: { remaining: number; onClick: () => void; full?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 text-sm font-semibold text-accent transition-colors hover:bg-base ${
        full ? "w-full py-3.5" : "rounded-2xl border border-border px-5 py-2.5"
      }`}
    >
      Voir plus de sons
      <ChevronDown size={16} />
      <span className="sr-only">({remaining} restants)</span>
    </button>
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

const SongMobileRow = memo(function SongMobileRow({
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
    <div className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-0">
      <button
        onClick={onPlay}
        aria-label={isCurrent && isPlaying ? "Mettre en pause" : `Lire ${song.title}`}
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors ${
          isCurrent ? "border-accent text-accent" : "border-border text-ink-muted"
        }`}
      >
        {isCurrent && isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
      </button>

      <SafeImage src={song.coverUrl} alt={song.title} width={48} height={48} className="h-12 w-12 shrink-0 rounded-lg object-cover" />

      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-semibold ${isCurrent ? "text-accent" : ""}`}>{song.title}</p>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-muted">
          <span className="truncate">{song.genre ?? "—"}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0">{formatDuration(song.duration)}</span>
          <span className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${meta.bg} ${meta.text}`}>
            {meta.label}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-ink-muted">
          <span className="flex items-center gap-1">
            <Play size={11} /> {formatCompactNumber(song.playsCount ?? 0)}
          </span>
          <span className="flex items-center gap-1">
            <Heart size={11} /> {formatCompactNumber(song.likesCount ?? 0)}
          </span>
          <span className="flex items-center gap-1">
            <Share2 size={11} /> {formatCompactNumber(song.sharesCount ?? 0)}
          </span>
        </div>
      </div>

      <button
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onOpenMenu(rect.right, rect.bottom + 4);
        }}
        aria-label={`Plus d'options pour ${song.title}`}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:text-accent"
      >
        <MoreVertical size={16} />
      </button>
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
