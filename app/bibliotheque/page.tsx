"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  LayoutGrid,
  ListMusic,
  Music2,
  Disc3,
  Users,
  Podcast,
  Download,
  Heart,
  WifiOff,
  HardDrive,
  Trash2,
  Wifi,
  Gauge,
  Plus,
  Sparkles,
} from "lucide-react";
import { SongTable } from "@/components/music/SongTable";
import { SongCard } from "@/components/home/SongCard";
import { SkeletonCard, SkeletonRows } from "@/components/ui/Skeleton";
import { PageSections } from "@/components/home/PageSections";
import { SafeImage } from "@/components/ui/SafeImage";
import { LibraryTabs, type LibraryTabKey } from "@/components/library/LibraryTabs";
import { LibraryStatCard } from "@/components/library/LibraryStatCard";
import { LibrarySectionHeader } from "@/components/library/LibrarySectionHeader";
import { AlbumCard } from "@/components/library/AlbumCard";
import { ArtistListItem } from "@/components/library/ArtistListItem";
import { CreatePlaylistTile } from "@/components/library/CreatePlaylistTile";
import { AiPlaylistModal } from "@/components/playlist/AiPlaylistModal";
import {
  listOfflineSongs,
  cleanupUnplayedSince,
  clearAllOfflineSongs,
  getStorageUsage,
  type OfflineSongMeta,
} from "@/lib/offlineCache";
import {
  getOfflineSettings,
  setOfflineSettings,
  type OfflineSettings,
  type AudioQuality,
} from "@/lib/offlineSettings";
import { useAsyncData, getJson } from "@/hooks/useAsyncData";
import { useToast } from "@/context/ToastProvider";
import { useIADisponible } from "@/context/SiteConfigProvider";
import type { PlayableSong } from "@/context/PlayerProvider";

type Playlist ={ _id: string; title: string; coverUrl?: string; songs: string[] };
type LibraryAlbum = {
  _id: string;
  title: string;
  coverUrl: string;
  artist: { _id: string; stageName: string; verified?: boolean } | null;
};
type FollowedArtist = { _id: string; stageName: string; verified?: boolean; coverUrl?: string; followersCount: number };

const TABS: { key: LibraryTabKey; label: string; icon: typeof LayoutGrid }[] = [
  { key: "tout", label: "Tout", icon: LayoutGrid },
  { key: "playlists", label: "Playlists", icon: ListMusic },
  { key: "titres", label: "Titres", icon: Music2 },
  { key: "albums", label: "Albums", icon: Disc3 },
  { key: "artistes", label: "Artistes", icon: Users },
  { key: "podcasts", label: "Podcasts", icon: Podcast },
  { key: "telechargements", label: "Téléchargements", icon: Download },
];

export default function LibraryPage() {
  const { status } = useSession();
  const pushToast = useToast();
  const [tab, setTab] = useState<LibraryTabKey>("tout");
  const [composerOuvert, setComposerOuvert] = useState(false);
  const iaPlaylist = useIADisponible("playlist");

  const isAuthed = status === "authenticated";

  // Cinq ressources indépendantes, chacune affichée dès son arrivée.
  // Elles étaient auparavant regroupées dans un `Promise.all` : la
  // bibliothèque restait vide le temps de la plus lente des cinq, alors
  // que les playlists — la requête la plus courte — sont prêtes bien avant
  // l'historique d'écoute.
  const { data: playlists, setData: setPlaylists, loading: playlistsLoading } = useAsyncData<Playlist[]>(
    isAuthed ? () => getJson("/api/playlists?owner=me", (d) => d.playlists as Playlist[], []) : null,
    [],
    status
  );
  const { data: likedSongs, loading: likedLoading } = useAsyncData<PlayableSong[]>(
    isAuthed ? () => getJson("/api/me/liked-songs", (d) => d.songs as PlayableSong[], []) : null,
    [],
    status
  );
  const { data: savedAlbums, setData: setSavedAlbums, loading: albumsLoading } = useAsyncData<LibraryAlbum[]>(
    isAuthed ? () => getJson("/api/me/saved-albums", (d) => d.albums as LibraryAlbum[], []) : null,
    [],
    status
  );
  const { data: followedArtists, setData: setFollowedArtists, loading: artistsLoading } = useAsyncData<FollowedArtist[]>(
    isAuthed ? () => getJson("/api/me/followed-artists", (d) => d.artists as FollowedArtist[], []) : null,
    [],
    status
  );
  const { data: recentSongs, loading: recentLoading } = useAsyncData<PlayableSong[]>(
    isAuthed ? () => getJson("/api/me/recent", (d) => d.songs as PlayableSong[], []) : null,
    [],
    status
  );

  const [offlineSongs, setOfflineSongs] = useState<OfflineSongMeta[]>([]);
  const [usage, setUsage] = useState<{ usedMB: number; quotaMB: number } | null>(null);
  const [settings, setSettings] = useState<OfflineSettings | null>(null);

  async function loadOfflineSongs() {
    setOfflineSongs(await listOfflineSongs());
    setUsage(await getStorageUsage());
  }

  useEffect(() => {
    loadOfflineSongs();
    getOfflineSettings().then(setSettings);
    window.addEventListener("moziik-offline-change", loadOfflineSongs);
    return () => window.removeEventListener("moziik-offline-change", loadOfflineSongs);
  }, []);

  async function updateSetting<K extends keyof OfflineSettings>(key: K, value: OfflineSettings[K]) {
    const next = await setOfflineSettings({ [key]: value });
    setSettings(next);
  }

  async function handleCleanup() {
    const removed = await cleanupUnplayedSince(90);
    pushToast("success", `${removed} son(s) non écouté(s) depuis 90 jours supprimé(s).`);
  }

  async function handleClearAll() {
    await clearAllOfflineSongs();
    pushToast("success", "Cache hors-ligne vidé.");
  }

  async function handleUnsaveAlbum(albumId: string) {
    setSavedAlbums((prev) => prev.filter((a) => a._id !== albumId));
    try {
      const res = await fetch("/api/me/saved-albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ albumId }),
      });
      if (!res.ok) throw new Error();
      pushToast("success", "Album retiré de ta bibliothèque.");
    } catch {
      pushToast("error", "Échec du retrait de l'album.");
    }
  }

  async function handleUnfollowArtist(artistId: string) {
    setFollowedArtists((prev) => prev.filter((a) => a._id !== artistId));
    try {
      const res = await fetch(`/api/artists/${artistId}/follow`, { method: "POST" });
      if (!res.ok) throw new Error();
      pushToast("success", "Tu ne suis plus cet artiste.");
    } catch {
      pushToast("error", "Échec de l'action.");
    }
  }

  function handlePlaylistCreated(playlist: Playlist) {
    setPlaylists((prev) => [playlist, ...prev]);
  }

  const activeTabs = useMemo(() => TABS, []);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-8 md:px-10 md:py-10">
      <h1 className="mb-6 text-2xl font-display">Ma bibliothèque</h1>

      <LibraryTabs tabs={activeTabs} active={tab} onChange={setTab} />

      <div className="mx-auto max-w-5xl">
        {isAuthed && (
          <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <LibraryStatCard
              icon={Heart}
              label="Titres likés"
              count={likedSongs.length}
              unit="titre(s)"
              tint="rose"
              active={tab === "titres"}
              onClick={() => setTab("titres")}
            />
            <LibraryStatCard
              icon={ListMusic}
              label="Playlists"
              count={playlists.length}
              unit="playlist(s)"
              tint="emerald"
              active={tab === "playlists"}
              onClick={() => setTab("playlists")}
            />
            <LibraryStatCard
              icon={Disc3}
              label="Albums"
              count={savedAlbums.length}
              unit="album(s)"
              tint="indigo"
              active={tab === "albums"}
              onClick={() => setTab("albums")}
            />
            <LibraryStatCard
              icon={Users}
              label="Artistes suivis"
              count={followedArtists.length}
              unit="artiste(s)"
              tint="amber"
              active={tab === "artistes"}
              onClick={() => setTab("artistes")}
            />
          </div>
        )}

        {!isAuthed && <p className="text-sm text-ink-muted">Connecte-toi pour retrouver ta bibliothèque.</p>}

        {isAuthed && tab === "tout" && (
          <div className="space-y-10">
            {(recentLoading || recentSongs.length > 0) && (
              <section>
                <LibrarySectionHeader title="Récemment écoutés" />
                <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
                  {recentLoading
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="w-32 shrink-0 sm:w-40">
                          <SkeletonCard />
                        </div>
                      ))
                    : recentSongs.map((song, index) => (
                        <div key={song._id} className="w-32 shrink-0 sm:w-40">
                          <SongCard song={song} queue={recentSongs} index={index} source={{ type: "history", label: "Récemment écouté" }} />
                        </div>
                      ))}
                </div>
              </section>
            )}

            <section>
              <LibrarySectionHeader title="Titres" onSeeAll={() => setTab("titres")} />
              {likedLoading ? (
                <SkeletonRows count={5} />
              ) : likedSongs.length === 0 ? (
                <p className="text-sm text-ink-muted">Aucun son aimé pour l&apos;instant.</p>
              ) : (
                <SongTable songs={likedSongs.slice(0, 5)} source={{ type: "favorites", label: "Titres likés" }} />
              )}
            </section>

            <div className="grid gap-6 lg:grid-cols-3">
              <section className="rounded-xl2 border border-border bg-surface p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-medium">Playlists</h2>
                  <button
                    onClick={() => setTab("playlists")}
                    className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                  >
                    <Plus size={12} /> Créer
                  </button>
                </div>
                {playlistsLoading ? (
                  <SkeletonRows count={3} />
                ) : playlists.length === 0 ? (
                  <p className="text-xs text-ink-muted">Pas encore de playlist.</p>
                ) : (
                  <div className="space-y-1">
                    {playlists.slice(0, 5).map((playlist) => (
                      <Link
                        key={playlist._id}
                        href={`/playlist/${playlist._id}`}
                        className="flex items-center gap-3 rounded-xl px-1.5 py-1.5 hover:bg-base"
                      >
                        <SafeImage
                          src={playlist.coverUrl}
                          alt={playlist.title}
                          width={36}
                          height={36}
                          className="shrink-0 rounded-lg object-cover"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm">{playlist.title}</span>
                          <span className="block text-xs text-ink-muted">{playlist.songs.length} titre(s)</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
                {playlists.length > 5 && (
                  <button
                    onClick={() => setTab("playlists")}
                    className="mt-2 text-xs font-medium text-accent hover:underline"
                  >
                    Voir toutes les playlists
                  </button>
                )}
              </section>

              <section className="rounded-xl2 border border-border bg-surface p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-medium">Albums</h2>
                  {savedAlbums.length > 0 && (
                    <button onClick={() => setTab("albums")} className="text-xs font-medium text-accent hover:underline">
                      Tout voir
                    </button>
                  )}
                </div>
                {albumsLoading ? (
                  <SkeletonRows count={3} />
                ) : savedAlbums.length === 0 ? (
                  <p className="text-xs text-ink-muted">
                    Aucun album enregistré — utilise l&apos;icône marque-page sur la page d&apos;un album.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {savedAlbums.slice(0, 5).map((album) => (
                      <Link
                        key={album._id}
                        href={`/album/${album._id}`}
                        className="flex items-center gap-3 rounded-xl px-1.5 py-1.5 hover:bg-base"
                      >
                        <SafeImage
                          src={album.coverUrl}
                          alt={album.title}
                          width={36}
                          height={36}
                          className="shrink-0 rounded-lg object-cover"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm">{album.title}</span>
                          <span className="block truncate text-xs text-ink-muted">
                            {album.artist?.stageName ?? "Artiste supprimé"}
                          </span>
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-xl2 border border-border bg-surface p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-medium">Artistes suivis</h2>
                  {followedArtists.length > 0 && (
                    <button onClick={() => setTab("artistes")} className="text-xs font-medium text-accent hover:underline">
                      Tout voir
                    </button>
                  )}
                </div>
                {artistsLoading ? (
                  <SkeletonRows count={3} />
                ) : followedArtists.length === 0 ? (
                  <p className="text-xs text-ink-muted">Tu ne suis encore aucun artiste.</p>
                ) : (
                  <div className="space-y-1">
                    {followedArtists.slice(0, 5).map((artist) => (
                      <Link
                        key={artist._id}
                        href={`/artiste/${artist._id}`}
                        className="flex items-center gap-3 rounded-xl px-1.5 py-1.5 hover:bg-base"
                      >
                        <SafeImage
                          src={artist.coverUrl}
                          alt={artist.stageName}
                          width={36}
                          height={36}
                          className="shrink-0 rounded-full object-cover"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm">{artist.stageName}</span>
                          <span className="block text-xs text-ink-muted">{artist.followersCount} abonnés</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <section>
              <LibrarySectionHeader title="Téléchargements" onSeeAll={() => setTab("telechargements")} />
              {offlineSongs.length === 0 ? (
                <p className="text-sm text-ink-muted">Aucun son téléchargé pour l&apos;instant.</p>
              ) : (
                <SongTable songs={offlineSongs.slice(0, 5) as PlayableSong[]} onDeleted={loadOfflineSongs} source={{ type: "downloads", label: "Téléchargements" }} />
              )}
            </section>
          </div>
        )}

        {isAuthed && tab === "playlists" && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {/* La tuile de création reste utilisable pendant le chargement :
                elle ne dépend d'aucune donnée distante. */}
            <CreatePlaylistTile onCreated={handlePlaylistCreated} />
            {/* Tuile jumelle : meme place, meme forme. Absente quand
                l'assistance n'est pas disponible, plutot qu'affichee et
                inerte. */}
            {iaPlaylist && (
              <button
                type="button"
                onClick={() => setComposerOuvert(true)}
                className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl2 border border-dashed border-border text-ink-muted transition-colors hover:border-accent hover:text-accent"
              >
                <Sparkles size={22} />
                <span className="px-2 text-center text-xs font-medium">Composer avec l&apos;IA</span>
              </button>
            )}
            {playlistsLoading && Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
            {playlists.map((playlist) => (
              <Link key={playlist._id} href={`/playlist/${playlist._id}`}>
                <SafeImage
                  src={playlist.coverUrl}
                  alt={playlist.title}
                  width={160}
                  height={160}
                  className="mb-2 aspect-square w-full rounded-xl2 object-cover"
                />
                <p className="truncate text-sm">{playlist.title}</p>
                <p className="text-xs text-ink-muted">{playlist.songs.length} son(s)</p>
              </Link>
            ))}
          </div>
        )}

        {isAuthed && tab === "titres" && (
          <div>
            {likedLoading ? (
              <SkeletonRows count={8} />
            ) : likedSongs.length === 0 ? (
              <p className="text-sm text-ink-muted">Aucun son aimé pour l&apos;instant.</p>
            ) : (
              <SongTable songs={likedSongs} source={{ type: "favorites", label: "Titres likés" }} />
            )}
          </div>
        )}

        {isAuthed && tab === "albums" && (
          <div>
            {albumsLoading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : savedAlbums.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Aucun album enregistré — utilise l&apos;icône marque-page sur la page d&apos;un album pour l&apos;ajouter ici.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {savedAlbums.map((album) => (
                  <AlbumCard key={album._id} album={album} onUnsave={handleUnsaveAlbum} />
                ))}
              </div>
            )}
          </div>
        )}

        {isAuthed && tab === "artistes" && (
          <div className="max-w-lg space-y-1">
            {artistsLoading ? (
              <SkeletonRows count={6} />
            ) : followedArtists.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Tu ne suis encore aucun artiste — retrouve-les depuis la recherche ou leur page.
              </p>
            ) : (
              followedArtists.map((artist) => (
                <ArtistListItem key={artist._id} artist={artist} onToggleFollow={handleUnfollowArtist} />
              ))
            )}
          </div>
        )}

        {tab === "podcasts" && (
          <div className="rounded-xl2 border border-dashed border-border p-8 text-center">
            <Podcast size={28} className="mx-auto mb-3 text-ink-muted" />
            <p className="text-sm font-medium">Podcasts bientôt disponibles</p>
            <p className="mt-1 text-xs text-ink-muted">
              Cette section arrivera dans une prochaine mise à jour de Moziik.
            </p>
          </div>
        )}

        {tab === "telechargements" && (
          <div className="space-y-8">
            <section>
              {offlineSongs.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  Aucun son téléchargé — utilise &quot;Écouter hors-ligne&quot; dans le menu &quot;...&quot; d&apos;un son,
                  ou télécharge un album/une playlist entière depuis sa page.
                </p>
              ) : (
                <SongTable songs={offlineSongs as PlayableSong[]} onDeleted={loadOfflineSongs} source={{ type: "downloads", label: "Téléchargements" }} />
              )}
            </section>

            {settings && (
              <section className="max-w-md space-y-6">
                <div className="rounded-xl2 border border-border bg-surface p-4">
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                    <HardDrive size={15} className="text-accent" /> Espace utilisé
                  </p>
                  {usage ? (
                    <>
                      <p className="mb-2 text-xs text-ink-muted">
                        {usage.usedMB} Mo utilisés sur {usage.quotaMB} Mo disponibles (estimation du navigateur)
                      </p>
                      <div className="h-2 overflow-hidden rounded-full bg-base">
                        <div
                          className="h-full bg-accent"
                          style={{ width: `${Math.min(100, (usage.usedMB / Math.max(usage.quotaMB, 1)) * 100)}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-ink-muted">Estimation non disponible sur ce navigateur.</p>
                  )}
                  <p className="mt-3 text-xs text-ink-muted">{offlineSongs.length} son(s) téléchargé(s)</p>
                </div>

                <div className="space-y-3 rounded-xl2 border border-border bg-surface p-4">
                  <p className="text-sm font-medium">Nettoyage</p>
                  <button
                    onClick={handleCleanup}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs text-ink-muted hover:border-accent hover:text-accent"
                  >
                    <Trash2 size={13} /> Supprimer les sons non écoutés depuis 90 jours
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-accent/40 py-2 text-xs text-accent hover:bg-accent/10"
                  >
                    <Trash2 size={13} /> Vider tout le cache hors-ligne
                  </button>
                </div>

                <div className="space-y-4 rounded-xl2 border border-border bg-surface p-4">
                  <p className="text-sm font-medium">Paramètres de téléchargement</p>

                  <label className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-ink-muted">
                      <Wifi size={14} /> Télécharger uniquement en Wi-Fi
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.wifiOnlyDownload}
                      onChange={(e) => updateSetting("wifiOnlyDownload", e.target.checked)}
                    />
                  </label>

                  <label className="flex items-center justify-between text-sm">
                    <span className="text-ink-muted">Télécharger auto. favoris & récents</span>
                    <input
                      type="checkbox"
                      checked={settings.autoDownloadFavorites}
                      onChange={(e) => updateSetting("autoDownloadFavorites", e.target.checked)}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-sm text-ink-muted">
                      <Gauge size={14} /> Qualité audio hors-ligne
                    </span>
                    <select
                      value={settings.audioQuality}
                      onChange={(e) => updateSetting("audioQuality", e.target.value as AudioQuality)}
                      className="w-full rounded-xl border border-border bg-base px-3.5 py-2 text-sm outline-none"
                    >
                      <option value="low">Faible (64 kb/s)</option>
                      <option value="medium">Moyenne (128 kb/s)</option>
                      <option value="high">Élevée (320 kb/s)</option>
                    </select>
                  </label>
                </div>
              </section>
            )}

            {!isAuthed && offlineSongs.length === 0 && (
              <p className="flex items-center gap-1.5 text-xs text-ink-muted">
                <WifiOff size={13} /> Les téléchargements hors-ligne fonctionnent aussi sans compte.
              </p>
            )}
          </div>
        )}

        {/* Sections éditoriales pilotées depuis l'administration. */}
        <PageSections page="library" className="mt-12" />
      </div>

      {composerOuvert && (
        <AiPlaylistModal
          onClose={() => setComposerOuvert(false)}
          onCreated={handlePlaylistCreated}
        />
      )}
    </div>
  );
}
