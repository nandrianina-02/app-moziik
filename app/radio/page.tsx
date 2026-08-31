"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Radio as RadioIcon,
  Heart,
  Plus,
  MoreHorizontal,
  Play,
  Flame,
  Sparkles,
  Guitar,
  Piano,
  Music2,
  Mic2,
  BadgeCheck,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Share2,
  ExternalLink,
} from "lucide-react";
import { usePlayer, type PlayableSong } from "@/context/PlayerProvider";
import { SafeImage } from "@/components/ui/SafeImage";
import { EqualizerLoader } from "@/components/ui/EqualizerLoader";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageSections } from "@/components/home/PageSections";
import { Reveal } from "@/components/layout/Reveal";
import { useToast } from "@/context/ToastProvider";
import { SongContextMenu } from "@/components/music/SongContextMenu";
import { useLongPress } from "@/components/music/useLongPress";
import { ContextMenuShell, MenuItem } from "@/components/ui/ContextMenuShell";
import { ShareModal } from "@/components/share/ShareModal";
import { StationPersonnelle } from "@/components/radio/StationPersonnelle";
import type { ShareSubject } from "@/components/share/shareSubject";
import { useUnivers } from "@/context/UniversProvider";

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// `genre` double l'information deja presente dans `fetchUrl` : c'est
// lui que le lecteur relit pour prolonger la station une fois les
// cinquante premiers titres joues.
type Station = {
  key: string;
  label: string;
  icon: typeof Flame;
  bg: string;
  fetchUrl: string;
  genre?: string;
};

const stations: Station[] = [
  // Les huit tuiles gardent une couleur fixe, indépendante du thème : du
  // blanc sur un aplat saturé sombre se lit sur les deux fonds. Le corail
  // clair faisait exception (2,8:1) — il est repris ici en corail profond.
  { key: "tendances", label: "Tendances", icon: Flame, bg: "bg-[#C63F1C]", fetchUrl: "/api/songs?limit=50&sort=popular" },
  { key: "favoris", label: "Mes favoris", icon: Heart, bg: "bg-[#C0356B]", fetchUrl: "/api/me/liked-songs" },
  { key: "nouveautes", label: "Nouveautés", icon: Sparkles, bg: "bg-[#2E5AAC]", fetchUrl: "/api/songs?limit=50" },
  { key: "afro", label: "Afro", icon: Mic2, bg: "bg-[#1B2A4A]", fetchUrl: "/api/songs?limit=50&genre=Afro", genre: "Afro" },
  { key: "rock", label: "Rock", icon: Guitar, bg: "bg-[#5B4FCF]", fetchUrl: "/api/songs?limit=50&genre=Rock", genre: "Rock" },
  { key: "instrumental", label: "Instrumental", icon: Piano, bg: "bg-[#4B3F8F]", fetchUrl: "/api/songs?limit=50&genre=Instrumental", genre: "Instrumental" },
  { key: "jazz", label: "Jazz", icon: Music2, bg: "bg-[#3D2F6F]", fetchUrl: "/api/songs?limit=50&genre=Jazz", genre: "Jazz" },
  { key: "gospel", label: "Gospel", icon: Sparkles, bg: "bg-[#B03050]", fetchUrl: "/api/songs?limit=50&genre=Gospel", genre: "Gospel" },
];

type RadioData = {
  topToday: { _id: string; title: string; coverUrl: string; artistName?: string; plays: number; rank: number }[];
  trending: { _id: string; title: string; coverUrl: string; artistName?: string; plays: number; rank: number; evolution: number | null }[];
  genres: { genre: string; count: number }[];
  recommendedArtists: { _id: string; stageName: string; coverUrl?: string; verified?: boolean; plays: number }[];
};

export default function RadioPage() {
  const pushToast = useToast();
  const { univers } = useUnivers();
  const { playQueue, currentSong, queue, isPlaying, togglePlay, progress } = usePlayer();
  const [loadingStation, setLoadingStation] = useState<string | null>(null);
  const [data, setData] = useState<RadioData | null>(null);
  // Distingue « pas encore arrivé » (squelettes) de « ne viendra pas »
  // (rien à afficher) : sans ce drapeau, un échec laisserait des
  // squelettes tourner indéfiniment.
  const [recoFailed, setRecoFailed] = useState(false);
  const [following, setFollowing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/radio")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setData)
      .catch(() => {
        setRecoFailed(true);
        pushToast("error", "Impossible de charger les recommandations radio.");
      });
    // `univers` en dépendance : le serveur le lit dans le cookie, mais
    // cette page a déjà ses données. Basculer d'univers doit donc
    // relancer la requête, sinon l'écran garde le catalogue précédent.
  }, [pushToast, univers]);

  async function launchStation(station: Station | null) {
    const key = station?.key ?? "default";
    setLoadingStation(key);
    try {
      const res = await fetch(station?.fetchUrl ?? "/api/songs?limit=50");
      if (!res.ok) throw new Error();
      const resData = await res.json();
      const songs = shuffle<PlayableSong>(resData.songs);
      if (songs.length === 0) {
        pushToast("error", "Pas encore de sons disponibles pour cette station.");
        return;
      }
      playQueue(songs, 0, {
        type: "radio",
        label: station ? station.label : "Moziik",
        genre: station?.genre,
      });
      pushToast("success", `Radio ${station ? station.label : "Moziik"} lancée.`);
    } catch {
      pushToast("error", "Impossible de lancer cette station.");
    } finally {
      setLoadingStation(null);
    }
  }

  async function toggleLikeCurrent() {
    if (!currentSong) return;
    try {
      const res = await fetch(`/api/songs/${currentSong._id}/like`, { method: "POST" });
      if (!res.ok) throw new Error();
      pushToast("success", "Préférence mise à jour.");
    } catch {
      pushToast("error", "Connecte-toi pour aimer un titre.");
    }
  }

  async function toggleFollow(artistId: string) {
    try {
      const res = await fetch(`/api/artists/${artistId}/follow`, { method: "POST" });
      if (!res.ok) throw new Error();
      const result = await res.json();
      setFollowing((prev) => ({ ...prev, [artistId]: result.following }));
    } catch {
      pushToast("error", "Connecte-toi pour suivre un artiste.");
    }
  }

  const progressPct = currentSong && currentSong.duration > 0 ? Math.min(100, (progress / currentSong.duration) * 100) : 0;
  const currentIndex = currentSong ? queue.findIndex((s) => s._id === currentSong._id) : -1;
  const upNext: PlayableSong[] = currentIndex >= 0 ? queue.slice(currentIndex + 1) : [];

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-8 md:px-10 md:py-10 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="max-w-lg">
          <h1 className="text-2xl font-display md:text-3xl">Radio Moziik</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Une sélection aléatoire et continue parmi tous les sons publiés sur la plateforme. Parfait pour découvrir
            de nouveaux artistes.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => launchStation(null)}
              disabled={loadingStation === "default"}
              className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-base hover:bg-accent-hover disabled:opacity-60"
            >
              {loadingStation === "default" ? <EqualizerLoader size="sm" /> : <RadioIcon size={16} />}
              Lancer la radio
            </button>
            <button
              onClick={toggleLikeCurrent}
              disabled={!currentSong}
              className="flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:border-accent disabled:opacity-60"
            >
              <Heart size={16} /> Ajouter aux favoris
            </button>
          </div>
        </div>
        <div className="relative hidden h-40 w-40 shrink-0 place-items-center sm:grid">
          <span className="absolute inset-0 rounded-full bg-accent/10" />
          <span className="absolute inset-4 rounded-full bg-accent/15" />
          <span className="absolute inset-9 rounded-full bg-accent/25" />
          <span className="relative grid h-16 w-16 place-items-center rounded-full bg-base shadow-lg">
            <RadioIcon size={22} className="text-accent" />
          </span>
        </div>
      </div>

      {/* La station bâtie pour l'auditeur passe avant les stations de
          genre : elle est la seule à dépendre de lui, les huit tuiles
          ci-dessous étant les mêmes pour tout le monde. */}
      <Reveal>
        <StationPersonnelle />
      </Reveal>

      {currentSong && <NowPlayingCard currentSong={currentSong} isPlaying={isPlaying} progress={progress} progressPct={progressPct} onToggleLike={toggleLikeCurrent} onTogglePlay={togglePlay} />}

      <Reveal className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-accent">Prochaines chansons</h2>
          <div className="rounded-xl2 border border-border bg-surface p-4">
            {upNext.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-muted">Lance la radio pour remplir la file.</p>
            ) : (
              <ul className="space-y-1">
                {upNext.slice(0, 5).map((song, i) => (
                  <UpNextRow key={song._id} song={song} index={i} />
                ))}
              </ul>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-accent">Stations rapides</h2>
          <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stations.map((station) => (
              <button
                key={station.key}
                onClick={() => launchStation(station)}
                disabled={loadingStation === station.key}
                className={`flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl2 text-white transition-transform hover:scale-[1.02] disabled:opacity-60 ${station.bg}`}
              >
                {loadingStation === station.key ? <EqualizerLoader size="sm" /> : <station.icon size={20} />}
                <span className="text-xs font-medium">{station.label}</span>
              </button>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="rounded-xl2 border border-border bg-surface p-6">
        <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-accent">Pourquoi écouter radio ?</h2>
        <ul className="space-y-2 text-sm">
          {[
            "Découvrez automatiquement de nouveaux artistes",
            "Lecture continue sans interruption",
            "Recommandations selon les titres les plus populaires",
            "Parfait pour travailler, se détendre ou voyager",
          ].map((line) => (
            <li key={line} className="flex items-center gap-2 text-ink-muted">
              <CheckCircle2 size={15} className="shrink-0 text-verified" /> {line}
            </li>
          ))}
        </ul>
        </section>
      </Reveal>

      {/* Les recommandations viennent d'un second appel : le haut de page
          (lancement de la radio, stations, file d'attente) est utilisable
          sans attendre, et ces blocs se remplissent ensuite. */}
      {!data && !recoFailed && (
        <div aria-busy="true" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-44 rounded-xl2" />
          <Skeleton className="h-44 rounded-xl2" />
          <Skeleton className="h-52 rounded-xl2" />
          <Skeleton className="h-52 rounded-xl2" />
        </div>
      )}

      {data && (
        <>
          <Reveal className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-accent">Artistes recommandés</h2>
              <div className="stagger flex flex-wrap gap-4">
                {data.recommendedArtists.map((artist) => (
                  <div key={artist._id} className="w-20 text-center">
                    <Link href={`/artiste/${artist._id}`}>
                      <SafeImage src={artist.coverUrl} alt={artist.stageName} width={64} height={64} className="mx-auto rounded-full object-cover" />
                    </Link>
                    <p className="mt-1.5 flex items-center justify-center gap-0.5 truncate text-xs font-medium">
                      {artist.stageName}
                      {artist.verified && <BadgeCheck size={10} className="shrink-0 text-verified" />}
                    </p>
                    <p className="truncate text-[11px] text-ink-muted">{artist.plays.toLocaleString("fr-FR")} écoutes</p>
                    <button
                      onClick={() => toggleFollow(artist._id)}
                      className={`mt-1.5 w-full rounded-full border px-2 py-1 text-[11px] font-medium ${
                        following[artist._id] ? "border-border text-ink-muted" : "border-accent text-accent hover:bg-accent/10"
                      }`}
                    >
                      {following[artist._id] ? "Abonné" : "Suivre"}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-medium uppercase tracking-wide text-accent">Genres populaires</h2>
                <Link href="/recherche" className="text-xs text-ink-muted hover:text-ink">
                  Voir tout
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.genres.map((g) => (
                  <button
                    key={g.genre}
                    onClick={() => launchStation({ key: g.genre, label: g.genre, icon: Music2, bg: "", fetchUrl: `/api/songs?limit=50&genre=${encodeURIComponent(g.genre)}` })}
                    className="rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-ink-muted hover:border-accent hover:text-ink"
                  >
                    {g.genre}
                  </button>
                ))}
              </div>
            </section>
          </Reveal>

          <Reveal className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-medium uppercase tracking-wide text-accent">Les plus écoutés aujourd&apos;hui</h2>
                <Link href="/classements" className="text-xs text-ink-muted hover:text-ink">
                  Voir tout
                </Link>
              </div>
              <div className="stagger grid grid-cols-3 gap-3 sm:grid-cols-5">
                {data.topToday.map((song, i) => (
                  <TopTodayTile key={song._id} song={song} rank={i + 1} />
                ))}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-medium uppercase tracking-wide text-accent">Tendances</h2>
                <Link href="/classements" className="text-xs text-ink-muted hover:text-ink">
                  Voir tout
                </Link>
              </div>
              <div className="rounded-xl2 border border-border bg-surface p-2">
                {data.trending.map((song) => (
                  <TrendingRow key={song._id} song={song} />
                ))}
              </div>
            </section>
          </Reveal>
        </>
      )}

      {/* Sections éditoriales pilotées depuis l'administration. */}
      <PageSections page="radio" />
    </div>
  );
}

function NowPlayingCard({
  currentSong,
  isPlaying,
  progress,
  progressPct,
  onToggleLike,
  onTogglePlay,
}: {
  currentSong: PlayableSong;
  isPlaying: boolean;
  progress: number;
  progressPct: number;
  onToggleLike: () => void;
  onTogglePlay: () => void;
}) {
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

  function openMenuAt(x: number, y: number) {
    setMenuPosition({ x, y });
  }
  const longPress = useLongPress((x, y) => openMenuAt(x, y));

  return (
    <section>
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-accent">En écoute</h2>
      <div
        className="flex flex-wrap items-center gap-5 rounded-xl2 border border-border bg-surface p-5"
        onContextMenu={(e) => {
          e.preventDefault();
          openMenuAt(e.clientX, e.clientY);
        }}
        onTouchStart={longPress.onTouchStart}
        onTouchEnd={longPress.onTouchEnd}
        onTouchMove={longPress.onTouchMove}
      >
        <SafeImage src={currentSong.coverUrl} alt={currentSong.title} width={88} height={88} className="rounded-xl2 object-cover shrink-0" />
        <div className="min-w-[180px] flex-1">
          <p className="text-lg font-display">{currentSong.title}</p>
          <p className="flex items-center gap-1 text-sm text-ink-muted">
            {currentSong.artist?.stageName ?? "Artiste supprimé"}
            {currentSong.artist?.verified && <BadgeCheck size={13} className="text-verified" />}
          </p>
          <span className="mt-1 inline-block rounded-md bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
            {isPlaying ? "EN COURS" : "EN PAUSE"}
          </span>
          <div className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
            <span>{formatTime(progress)}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-base">
              <div className="h-full rounded-full bg-accent" style={{ width: `${progressPct}%` }} />
            </div>
            <span>{formatTime(currentSong.duration)}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={onToggleLike} className="grid h-9 w-9 place-items-center rounded-full border border-border hover:border-accent hover:text-accent">
            <Heart size={15} />
          </button>
          <button onClick={onTogglePlay} className="grid h-9 w-9 place-items-center rounded-full border border-border hover:border-accent hover:text-accent">
            <Plus size={15} />
          </button>
          <button
            onClick={(e) => openMenuAt(e.clientX, e.clientY)}
            className="grid h-9 w-9 place-items-center rounded-full border border-border hover:border-accent hover:text-accent"
          >
            <MoreHorizontal size={15} />
          </button>
        </div>
      </div>

      {menuPosition && <SongContextMenu song={currentSong} position={menuPosition} onClose={() => setMenuPosition(null)} />}
    </section>
  );
}

function UpNextRow({ song, index }: { song: PlayableSong; index: number }) {
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

  function openMenuAt(x: number, y: number) {
    setMenuPosition({ x, y });
  }
  const longPress = useLongPress((x, y) => openMenuAt(x, y));

  return (
    <li
      className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-base"
      onContextMenu={(e) => {
        e.preventDefault();
        openMenuAt(e.clientX, e.clientY);
      }}
      onTouchStart={longPress.onTouchStart}
      onTouchEnd={longPress.onTouchEnd}
      onTouchMove={longPress.onTouchMove}
    >
      <span className="w-4 text-xs text-ink-muted">{index + 1}</span>
      <SafeImage src={song.coverUrl} alt={song.title} width={36} height={36} className="rounded-lg object-cover" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{song.title}</span>
        <span className="block truncate text-xs text-ink-muted">{song.artist?.stageName ?? "Artiste supprimé"}</span>
      </span>
      <span className="text-xs text-ink-muted">{formatTime(song.duration)}</span>

      {menuPosition && <SongContextMenu song={song} position={menuPosition} onClose={() => setMenuPosition(null)} />}
    </li>
  );
}

// Top du jour / Tendances : /api/radio ne renvoie pas l'audioUrl (pas
// nécessaire à l'affichage), donc pas de menu de lecture complet possible
// ici — seulement partager + ouvrir la page, sur le même principe que
// CustomCollection sur l'accueil.
function radioItemToShareSubject(song: { _id: string; title: string; coverUrl: string; artistName?: string }): ShareSubject {
  return {
    type: "song",
    id: song._id,
    title: song.title,
    subtitle: song.artistName,
    coverUrl: song.coverUrl,
    path: `/son/${song._id}`,
    stats: [],
  };
}

function TopTodayTile({ song, rank }: { song: RadioData["topToday"][number]; rank: number }) {
  const router = useRouter();
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  function openMenuAt(x: number, y: number) {
    setMenuPosition({ x, y });
  }
  const longPress = useLongPress((x, y) => openMenuAt(x, y));

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        openMenuAt(e.clientX, e.clientY);
      }}
      onTouchStart={longPress.onTouchStart}
      onTouchEnd={longPress.onTouchEnd}
      onTouchMove={longPress.onTouchMove}
    >
      <Link href={`/son/${song._id}`} className="group">
        <div className="relative aspect-square overflow-hidden rounded-xl2 bg-base">
          <SafeImage src={song.coverUrl} alt={song.title} width={120} height={120} className="h-full w-full object-cover" />
          <span className="absolute inset-0 grid place-items-center bg-black/0 transition-colors group-hover:bg-black/30">
            <Play size={20} className="text-white opacity-0 group-hover:opacity-100" fill="currentColor" />
          </span>
        </div>
        <p className="mt-1.5 truncate text-xs font-medium">{rank}. {song.title}</p>
        <p className="truncate text-[11px] text-ink-muted">{song.artistName ?? "Artiste supprimé"}</p>
      </Link>

      {menuPosition && (
        <ContextMenuShell anchor={menuPosition} onClose={() => setMenuPosition(null)}>
          <MenuItem
            icon={Share2}
            label="Partager"
            onClick={() => {
              setShowShareModal(true);
              setMenuPosition(null);
            }}
          />
          <MenuItem
            icon={ExternalLink}
            label="Ouvrir"
            onClick={() => {
              router.push(`/son/${song._id}`);
              setMenuPosition(null);
            }}
          />
        </ContextMenuShell>
      )}

      {showShareModal && <ShareModal subject={radioItemToShareSubject(song)} onClose={() => setShowShareModal(false)} />}
    </div>
  );
}

function TrendingRow({ song }: { song: RadioData["trending"][number] }) {
  const router = useRouter();
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  function openMenuAt(x: number, y: number) {
    setMenuPosition({ x, y });
  }
  const longPress = useLongPress((x, y) => openMenuAt(x, y));

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        openMenuAt(e.clientX, e.clientY);
      }}
      onTouchStart={longPress.onTouchStart}
      onTouchEnd={longPress.onTouchEnd}
      onTouchMove={longPress.onTouchMove}
    >
      <Link href={`/son/${song._id}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-base">
        <span className="w-5 text-xs text-ink-muted">{String(song.rank).padStart(2, "0")}</span>
        <SafeImage src={song.coverUrl} alt={song.title} width={36} height={36} className="rounded-lg object-cover" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{song.title}</span>
          <span className="block truncate text-xs text-ink-muted">{song.artistName ?? "Artiste supprimé"}</span>
        </span>
        {song.evolution !== null && song.evolution !== 0 && (
          <span className={`flex items-center gap-0.5 text-xs ${song.evolution > 0 ? "text-verified" : "text-accent"}`}>
            {song.evolution > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          </span>
        )}
      </Link>

      {menuPosition && (
        <ContextMenuShell anchor={menuPosition} onClose={() => setMenuPosition(null)}>
          <MenuItem
            icon={Share2}
            label="Partager"
            onClick={() => {
              setShowShareModal(true);
              setMenuPosition(null);
            }}
          />
          <MenuItem
            icon={ExternalLink}
            label="Ouvrir"
            onClick={() => {
              router.push(`/son/${song._id}`);
              setMenuPosition(null);
            }}
          />
        </ContextMenuShell>
      )}

      {showShareModal && <ShareModal subject={radioItemToShareSubject(song)} onClose={() => setShowShareModal(false)} />}
    </div>
  );
}
