"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search as SearchIcon,
  BadgeCheck,
  WifiOff,
  X,
  Play,
  ChevronRight,
  Trash2,
  Compass,
} from "lucide-react";
import { SongRow } from "@/components/music/SongRow";
import { SafeImage } from "@/components/ui/SafeImage";
import { EqualizerLoader } from "@/components/ui/EqualizerLoader";
import { useOnlineStatus } from "@/context/OnlineStatusProvider";
import { listOfflineSongs } from "@/lib/offlineCache";
import {
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
  type RecentSearchItem,
} from "@/lib/recentSearches";
import type { PlayableSong } from "@/context/PlayerProvider";

type ArtistResult = { _id: string; stageName: string; verified?: boolean; coverUrl?: string };

type PopularItem =
  | { kind: "artist"; _id: string; title: string; coverUrl?: string; verified?: boolean }
  | { kind: "song"; _id: string; title: string; coverUrl?: string; verified?: boolean; artistName: string };

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isOnline } = useOnlineStatus();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [songs, setSongs] = useState<PlayableSong[]>([]);
  const [artists, setArtists] = useState<ArtistResult[]>([]);
  const [loading, setLoading] = useState(false);

  const [recent, setRecent] = useState<RecentSearchItem[]>([]);
  const [popular, setPopular] = useState<PopularItem[]>([]);
  const [loadingPopular, setLoadingPopular] = useState(true);

  useEffect(() => {
    function loadRecent() {
      setRecent(getRecentSearches());
    }
    loadRecent();
    window.addEventListener("moziik-recent-searches-change", loadRecent);
    return () => window.removeEventListener("moziik-recent-searches-change", loadRecent);
  }, []);

  useEffect(() => {
    async function loadPopular() {
      try {
        const [artistsRes, songsRes] = await Promise.all([
          fetch("/api/charts?period=month&type=artists"),
          fetch("/api/charts?period=month&type=songs"),
        ]);
        const artistsData = artistsRes.ok ? (await artistsRes.json()).ranking : [];
        const songsData = songsRes.ok ? (await songsRes.json()).ranking : [];

        let items: PopularItem[] = [
          ...artistsData.slice(0, 3).map((a: { _id: string; stageName: string; coverUrl?: string; verified?: boolean }) => ({
            kind: "artist" as const,
            _id: a._id,
            title: a.stageName,
            coverUrl: a.coverUrl,
            verified: a.verified,
          })),
          ...songsData.slice(0, 3).map((s: { _id: string; title: string; coverUrl?: string; verified?: boolean; artistName: string }) => ({
            kind: "song" as const,
            _id: s._id,
            title: s.title,
            coverUrl: s.coverUrl,
            verified: s.verified,
            artistName: s.artistName,
          })),
        ];

        // Repli sur du contenu réel récent si pas encore assez d'écoutes
        // enregistrées pour établir un vrai classement.
        if (items.length < 4) {
          const [songsFallback, artistsFallback] = await Promise.all([
            fetch("/api/songs?limit=3").then((r) => (r.ok ? r.json() : { songs: [] })),
            fetch("/api/artists").then((r) => (r.ok ? r.json() : { artists: [] })),
          ]);
          items = [
            ...artistsFallback.artists.slice(0, 3).map((a: ArtistResult) => ({
              kind: "artist" as const,
              _id: a._id,
              title: a.stageName,
              coverUrl: a.coverUrl,
              verified: a.verified,
            })),
            ...songsFallback.songs.slice(0, 3).map((s: PlayableSong) => ({
              kind: "song" as const,
              _id: s._id,
              title: s.title,
              coverUrl: s.coverUrl,
              verified: s.artist?.verified,
              artistName: s.artist?.stageName ?? "Artiste supprimé",
            })),
          ];
        }

        setPopular(items);
      } finally {
        setLoadingPopular(false);
      }
    }
    loadPopular();
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSongs([]);
      setArtists([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        if (!isOnline) {
          const offline = await listOfflineSongs();
          const q = query.trim().toLowerCase();
          setSongs(offline.filter((s) => s.title.toLowerCase().includes(q) || s.artist.stageName.toLowerCase().includes(q)));
          setArtists([]);
          return;
        }
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setSongs(data.songs);
          setArtists(data.artists);
        }
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, isOnline]);

  function trackArtist(artist: ArtistResult) {
    addRecentSearch({
      _id: artist._id,
      type: "artist",
      title: artist.stageName,
      coverUrl: artist.coverUrl ?? "",
      subtitle: "Artiste",
      verified: artist.verified,
      href: `/artiste/${artist._id}`,
    });
  }

  function trackSong(song: PlayableSong) {
    addRecentSearch({
      _id: song._id,
      type: "song",
      title: song.title,
      coverUrl: song.coverUrl,
      subtitle: song.artist?.stageName ?? "Artiste supprimé",
      verified: song.artist?.verified,
      playsCount: song.playsCount,
      href: `/son/${song._id}`,
    });
  }

  const showDefaultState = query.trim().length < 2;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 md:px-10 md:py-10">
      <h1 className="text-2xl font-display mb-6">Recherche</h1>

      {!isOnline && (
        <p className="flex items-center gap-1.5 text-xs text-accent mb-4">
          <WifiOff size={12} /> Hors-ligne — recherche limitée à tes sons téléchargés
        </p>
      )}

      <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 mb-8">
        <SearchIcon size={18} className="text-ink-muted shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un son, un artiste, un album..."
          className="flex-1 bg-transparent text-sm outline-none"
          autoFocus
        />
      </label>

      {loading && (
        <div className="py-10 grid place-items-center">
          <EqualizerLoader />
        </div>
      )}

      {!showDefaultState && !loading && artists.length === 0 && songs.length === 0 && (
        <p className="text-sm text-ink-muted">Aucun résultat pour &quot;{query}&quot;.</p>
      )}

      {!showDefaultState && artists.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm uppercase tracking-wide text-ink-muted mb-4">Artistes</h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {artists.map((artist) => (
              <Link
                key={artist._id}
                href={`/artiste/${artist._id}`}
                onClick={() => trackArtist(artist)}
                className="shrink-0 w-20 text-center"
              >
                <SafeImage src={artist.coverUrl} alt={artist.stageName} width={64} height={64} className="rounded-full object-cover mx-auto mb-2" />
                <p className="text-xs truncate flex items-center justify-center gap-1">
                  {artist.stageName}
                  {artist.verified && <BadgeCheck size={11} className="text-verified shrink-0" />}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!showDefaultState && songs.length > 0 && (
        <section>
          <h2 className="text-sm uppercase tracking-wide text-ink-muted mb-4">Sons</h2>
          <div className="space-y-1">
            {songs.map((song, index) => (
              <div key={song._id} onClick={() => trackSong(song)}>
                <SongRow song={song} queue={songs} index={index} source={{ type: "search", label: `« ${query.trim()} »` }} />
              </div>
            ))}
          </div>
        </section>
      )}

      {showDefaultState && (
        <>
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg">Dernières recherches</h2>
              {recent.length > 0 && (
                <button
                  onClick={clearRecentSearches}
                  className="flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  <Trash2 size={12} /> Effacer l&apos;historique
                </button>
              )}
            </div>

            {recent.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Tes recherches récentes apparaîtront ici.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {recent.map((item) => (
                  <div key={item._id} className="relative rounded-xl2 border border-border bg-surface p-3">
                    <button
                      onClick={() => removeRecentSearch(item._id)}
                      aria-label="Retirer de l'historique"
                      className="absolute top-2.5 right-2.5 grid h-6 w-6 place-items-center rounded-full bg-base/80 text-ink-muted hover:text-accent"
                    >
                      <X size={12} />
                    </button>
                    <Link href={item.href}>
                      <SafeImage src={item.coverUrl} alt={item.title} width={100} height={100} className="rounded-lg object-cover w-full aspect-square mb-3" />
                      <p className="flex items-center gap-1 text-sm font-medium truncate">
                        {item.title}
                        {item.verified && <BadgeCheck size={12} className="text-verified shrink-0" />}
                      </p>
                      <p className="text-xs text-ink-muted truncate mb-1.5">{item.subtitle}</p>
                      {item.type === "song" && typeof item.playsCount === "number" && (
                        <p className="flex items-center gap-1 text-[11px] text-ink-muted">
                          <Play size={10} /> {item.playsCount} écoute{item.playsCount > 1 ? "s" : ""}
                        </p>
                      )}
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg">Suggestions populaires</h2>
              <Link href="/classements" className="text-xs text-accent hover:underline">
                Tout voir
              </Link>
            </div>

            {loadingPopular && (
              <div className="py-6 grid place-items-center">
                <EqualizerLoader size="sm" />
              </div>
            )}

            {!loadingPopular && popular.length === 0 && (
              <p className="text-sm text-ink-muted">Pas encore assez de contenu à suggérer.</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {popular.map((item) => (
                <Link
                  key={`${item.kind}-${item._id}`}
                  href={item.kind === "artist" ? `/artiste/${item._id}` : `/son/${item._id}`}
                  className="flex items-center gap-3 rounded-xl2 border border-border bg-surface px-4 py-3 hover:border-accent transition-colors"
                >
                  <SafeImage
                    src={item.coverUrl}
                    alt={item.title}
                    width={44}
                    height={44}
                    className={`object-cover shrink-0 ${item.kind === "artist" ? "rounded-full" : "rounded-lg"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 text-sm font-medium truncate">
                      {item.title}
                      {item.verified && <BadgeCheck size={12} className="text-verified shrink-0" />}
                    </p>
                    <p className="text-xs text-ink-muted truncate">
                      {item.kind === "artist" ? "Artiste" : `Son · ${item.artistName}`}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-ink-muted shrink-0" />
                </Link>
              ))}
            </div>
          </section>

          <section className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl2 bg-accent/10 border border-accent/20 p-5 sm:p-6">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
              <Compass size={22} />
            </span>
            <div className="flex-1">
              <p className="font-display text-base mb-1 text-ink">Découvrez de nouveaux sons</p>
              <p className="text-sm text-ink-muted">
                Recherchez un morceau, un artiste ou un album et profitez de votre musique.
              </p>
            </div>
            <button
              onClick={() => router.push("/radio")}
              className="rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-base hover:bg-accent-hover shrink-0"
            >
              Explorer
            </button>
          </section>
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageContent />
    </Suspense>
  );
}
