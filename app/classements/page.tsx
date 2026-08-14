"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Trophy, TrendingUp, TrendingDown, Minus, Play, Pause, MoreVertical, ChevronDown } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { EqualizerLoader } from "@/components/ui/EqualizerLoader";
import { Reveal } from "@/components/layout/Reveal";
import { useToast } from "@/context/ToastProvider";
import { useSession } from "next-auth/react";
import { usePlayer, type PlayableSong } from "@/context/PlayerProvider";
import { SongContextMenu } from "@/components/music/SongContextMenu";
import { useLongPress } from "@/components/music/useLongPress";

type Period = "day" | "week" | "month" | "year" | "all";
type ChartType = "songs" | "artists" | "albums" | "listeners";

const periods: { value: Period; label: string }[] = [
  { value: "day", label: "Aujourd'hui" },
  { value: "week", label: "Semaine" },
  { value: "month", label: "Mois" },
  { value: "year", label: "Année" },
  { value: "all", label: "Tout" },
];

const types: { value: ChartType; label: string }[] = [
  { value: "songs", label: "Sons" },
  { value: "artists", label: "Artistes" },
  { value: "albums", label: "Albums" },
  { value: "listeners", label: "Auditeurs" },
];

type RankingItem = {
  _id: string;
  plays: number;
  rank: number;
  evolution: number | null;
  title?: string;
  stageName?: string;
  name?: string;
  coverUrl?: string;
  avatarUrl?: string;
  artistName?: string;
  artistId?: string;
  genre?: string;
  verified?: boolean;
  audioUrl?: string;
  duration?: number;
};

type Viewer = { rank: number; plays: number; evolution: number | null; toNextMilestone: number };

const podiumStyle = [
  { badge: "bg-[#F5C542] text-black/80", ring: "ring-2 ring-[#F5C542]", order: "md:order-2 md:scale-110" },
  { badge: "bg-[#C7C7C7] text-black/80", ring: "", order: "md:order-1" },
  { badge: "bg-[#C08A50] text-black/80", ring: "", order: "md:order-3" },
];

function itemLabel(item: RankingItem) {
  return item.title ?? item.stageName ?? item.name ?? "";
}

/** Convertit un item de classement (titre) en PlayableSong pour le menu contextuel. */
function itemToPlayableSong(item: RankingItem): PlayableSong {
  return {
    _id: item._id,
    title: item.title ?? "",
    coverUrl: item.coverUrl ?? "",
    audioUrl: item.audioUrl ?? "",
    duration: item.duration ?? 0,
    artist: item.artistId ? { _id: item.artistId, stageName: item.artistName ?? "", verified: item.verified } : null,
  };
}

export default function ChartsPage() {
  const pushToast = useToast();
  const { data: session } = useSession();
  const [period, setPeriod] = useState<Period>("week");
  const [type, setType] = useState<ChartType>("songs");
  const [genre, setGenre] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [totalPlays, setTotalPlays] = useState(0);
  const [trendPct, setTrendPct] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ period, type });
        if (genre) params.set("genre", genre);
        const res = await fetch(`/api/charts?${params}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setRanking(data.ranking);
        setViewer(data.viewer);
        setTotalPlays(data.totalPlays);
        setTrendPct(data.trendPct);
        setGenres(data.genres ?? []);
      } catch {
        pushToast("error", "Impossible de charger le classement.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [period, type, genre, pushToast]);

  const { currentSong, isPlaying, playQueue, togglePlay } = usePlayer();

  function toPlayableSongs(items: RankingItem[]): PlayableSong[] {
    return items
      .filter((item) => item.audioUrl)
      .map((item) => ({
        _id: item._id,
        title: item.title ?? "",
        coverUrl: item.coverUrl ?? "",
        audioUrl: item.audioUrl ?? "",
        duration: item.duration ?? 0,
        artist: item.artistId ? { _id: item.artistId, stageName: item.artistName ?? "", verified: item.verified } : null,
      }));
  }

  function playFrom(index: number) {
    if (type !== "songs") return;
    const song = ranking[index];
    if (!song) return;
    if (currentSong?._id === song._id) {
      togglePlay();
      return;
    }
    const songsQueue = toPlayableSongs(ranking);
    const targetIndex = songsQueue.findIndex((s) => s._id === song._id);
    if (targetIndex === -1) return;
    const periodLabel = periods.find((p) => p.value === period)?.label ?? "";
    playQueue(songsQueue, targetIndex, { type: "chart", label: `Classement · ${periodLabel}` });
  }

  const podium = ranking.slice(0, 3);
  const rest = ranking.slice(3);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-8 md:px-10 md:py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display">Classements</h1>
          <p className="mt-1 text-sm text-ink-muted">Les contenus les plus populaires sur Moziik</p>
        </div>

        {(type === "songs" || type === "albums") && (
          <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm">
            <span className="text-ink-muted">Genre :</span>
            <select value={genre} onChange={(e) => setGenre(e.target.value)} className="bg-transparent outline-none">
              <option value="">Tous les genres</option>
              {genres.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="text-ink-muted" />
          </label>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {types.map((t) => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition-colors ${
              type === t.value ? "bg-accent text-base border-accent" : "border-border text-ink-muted hover:border-accent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition-colors ${
              period === p.value ? "bg-accent text-base border-accent" : "border-border text-ink-muted hover:border-accent"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="py-16 grid place-items-center">
          <EqualizerLoader />
        </div>
      )}

      {!loading && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr_260px]">
            {session?.user && viewer ? (
              <div className="rounded-xl2 border border-border bg-surface p-5">
                <h3 className="mb-3 text-sm font-medium text-accent">Votre classement</h3>
                <div className="flex items-center gap-3">
                  <SafeImage src={session.user.image ?? undefined} alt="" width={56} height={56} className="rounded-full object-cover" />
                  <div>
                    <p className="font-display text-lg">Rang : #{viewer.rank}</p>
                    {viewer.evolution !== null && viewer.evolution !== 0 && (
                      <p className={`flex items-center gap-1 text-xs ${viewer.evolution > 0 ? "text-verified" : "text-accent"}`}>
                        {viewer.evolution > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {Math.abs(viewer.evolution)} place{Math.abs(viewer.evolution) > 1 ? "s" : ""}{" "}
                        {viewer.evolution > 0 ? "gagnées" : "perdues"}
                      </p>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-xs text-ink-muted">{viewer.plays} écoutes</p>
                {viewer.rank > 100 && viewer.toNextMilestone > 0 ? (
                  <div className="mt-3">
                    <p className="mb-1 text-xs text-ink-muted">
                      Encore {viewer.toNextMilestone} écoute{viewer.toNextMilestone > 1 ? "s" : ""} pour entrer dans le Top 100
                    </p>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-base">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${Math.min(100, (viewer.plays / (viewer.plays + viewer.toNextMilestone)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ) : viewer.rank <= 100 ? (
                  <p className="mt-3 text-xs font-medium text-verified">Vous êtes dans le Top 100 🔥</p>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl2 border border-dashed border-border p-5 text-sm text-ink-muted">
                {session?.user
                  ? "Écoute des titres pour apparaître dans ce classement."
                  : "Connecte-toi pour voir ta position dans ce classement."}
              </div>
            )}

            <div className="rounded-xl2 border border-border bg-surface p-5">
              <div className="mb-4 flex items-center gap-1.5 text-sm font-medium">
                <Trophy size={16} className="text-[#F5C542]" /> Top 3
              </div>
              {podium.length === 0 ? (
                <p className="text-sm text-ink-muted">Pas encore assez d&apos;écoutes sur cette période.</p>
              ) : (
                <div className="stagger grid grid-cols-3 gap-3">
                  {podium.map((item, i) => (
                    <PodiumTile key={item._id} item={item} index={i} type={type} onPlay={() => playFrom(i)} />
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl2 border border-border bg-surface p-5">
              <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-accent">
                <TrendingUp size={16} /> Tendances
              </div>
              {trendPct !== null && (
                <p className="text-sm text-verified">
                  {trendPct >= 0 ? "+" : ""}
                  {trendPct.toFixed(0)}% d&apos;écoutes cette période
                </p>
              )}
              <p className="mt-1 text-xs text-ink-muted">{totalPlays.toLocaleString("fr-FR")} écoutes au total</p>
            </div>
          </div>

          {rest.length === 0 && podium.length === 0 ? null : (
            <Reveal className="overflow-x-auto rounded-xl2 border border-border bg-surface">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-ink-muted">
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">
                      {type === "songs" ? "Titre" : type === "albums" ? "Album" : type === "artists" ? "Artiste" : "Auditeur"}
                    </th>
                    {type === "songs" && <th className="px-4 py-3 font-medium">Genre</th>}
                    <th className="px-4 py-3 font-medium">Écoutes</th>
                    <th className="px-4 py-3 font-medium">Évolution</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {rest.map((item, i) => (
                    <RankingRow
                      key={item._id}
                      item={item}
                      type={type}
                      isCurrent={currentSong?._id === item._id}
                      isPlaying={isPlaying}
                      maxPlays={podium[0]?.plays ?? item.plays}
                      onPlay={() => playFrom(i + 3)}
                    />
                  ))}
                </tbody>
              </table>
            </Reveal>
          )}
        </>
      )}
    </div>
  );
}

function PodiumTile({
  item,
  index,
  type,
  onPlay,
}: {
  item: RankingItem;
  index: number;
  type: ChartType;
  onPlay: () => void;
}) {
  const { currentSong, isPlaying } = usePlayer();
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const isCurrent = type === "songs" && currentSong?._id === item._id;
  const playableSong = type === "songs" && item.audioUrl ? itemToPlayableSong(item) : null;

  function openMenuAt(x: number, y: number) {
    setMenuPosition({ x, y });
  }
  const longPress = useLongPress((x, y) => openMenuAt(x, y));

  return (
    <div
      className="relative"
      onContextMenu={
        playableSong
          ? (e) => {
              e.preventDefault();
              openMenuAt(e.clientX, e.clientY);
            }
          : undefined
      }
      onTouchStart={playableSong ? longPress.onTouchStart : undefined}
      onTouchEnd={playableSong ? longPress.onTouchEnd : undefined}
      onTouchMove={playableSong ? longPress.onTouchMove : undefined}
    >
      <button
        onClick={onPlay}
        className={`relative flex w-full flex-col justify-end overflow-hidden rounded-xl2 text-left text-white aspect-[3/4] ${podiumStyle[index].order} ${
          isCurrent ? "ring-2 ring-accent" : ""
        }`}
      >
        <SafeImage src={item.coverUrl ?? item.avatarUrl} alt="" width={200} height={260} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        <span className={`absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${podiumStyle[index].badge}`}>
          {index + 1}
        </span>
        <div className="relative p-3">
          <p className="truncate text-sm font-display">{itemLabel(item)}</p>
          {item.artistName && <p className="truncate text-xs text-white/75">{item.artistName}</p>}
          <p className="mt-1 flex items-center gap-1 text-xs font-medium">
            {isCurrent && isPlaying ? <Pause size={11} fill="currentColor" /> : <Play size={11} fill="currentColor" />}{" "}
            {item.plays.toLocaleString("fr-FR")} écoutes
          </p>
        </div>
      </button>

      {menuPosition && playableSong && (
        <SongContextMenu song={playableSong} position={menuPosition} onClose={() => setMenuPosition(null)} />
      )}
    </div>
  );
}

function RankingRow({
  item,
  type,
  isCurrent,
  isPlaying,
  maxPlays,
  onPlay,
}: {
  item: RankingItem;
  type: ChartType;
  isCurrent: boolean;
  isPlaying: boolean;
  maxPlays: number;
  onPlay: () => void;
}) {
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const playableSong = type === "songs" && item.audioUrl ? itemToPlayableSong(item) : null;

  function openMenuAt(x: number, y: number) {
    setMenuPosition({ x, y });
  }
  const longPress = useLongPress((x, y) => openMenuAt(x, y));

  return (
    <tr
      className="border-b border-border/60 last:border-0"
      onContextMenu={
        playableSong
          ? (e) => {
              e.preventDefault();
              openMenuAt(e.clientX, e.clientY);
            }
          : undefined
      }
      onTouchStart={playableSong ? longPress.onTouchStart : undefined}
      onTouchEnd={playableSong ? longPress.onTouchEnd : undefined}
      onTouchMove={playableSong ? longPress.onTouchMove : undefined}
    >
      <td className="px-4 py-3 text-ink-muted">{item.rank}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <SafeImage src={item.coverUrl ?? item.avatarUrl} alt="" width={36} height={36} className="rounded-lg object-cover shrink-0" />
          <div className="min-w-0">
            <p className="flex items-center gap-1 truncate font-medium">
              {itemLabel(item)}
              {item.verified && <BadgeCheck size={12} className="shrink-0 text-verified" />}
            </p>
            {item.artistName && <p className="truncate text-xs text-ink-muted">{item.artistName}</p>}
          </div>
        </div>
      </td>
      {type === "songs" && <td className="px-4 py-3 text-ink-muted">{item.genre}</td>}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0">{item.plays.toLocaleString("fr-FR")}</span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-base">
            <div className="h-full rounded-full bg-accent" style={{ width: `${maxPlays ? Math.min(100, (item.plays / maxPlays) * 100) : 0}%` }} />
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {item.evolution === null ? (
          <span className="text-ink-muted">Nouveau</span>
        ) : item.evolution === 0 ? (
          <span className="flex items-center gap-1 text-ink-muted">
            <Minus size={12} />
          </span>
        ) : item.evolution > 0 ? (
          <span className="flex items-center gap-1 text-verified">
            <TrendingUp size={12} /> {item.evolution}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-accent">
            <TrendingDown size={12} /> {Math.abs(item.evolution)}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {type === "songs" && (
            <button
              onClick={onPlay}
              className={`grid h-8 w-8 place-items-center rounded-full border transition-colors ${
                isCurrent ? "border-accent text-accent" : "border-border text-ink-muted hover:border-accent hover:text-accent"
              }`}
            >
              {isCurrent && isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
            </button>
          )}
          <button
            onClick={(e) => openMenuAt(e.clientX, e.clientY)}
            disabled={!playableSong}
            className="grid h-8 w-8 place-items-center rounded-full text-ink-muted hover:text-ink disabled:opacity-40"
          >
            <MoreVertical size={15} />
          </button>
        </div>
      </td>

      {menuPosition && playableSong && (
        <SongContextMenu song={playableSong} position={menuPosition} onClose={() => setMenuPosition(null)} />
      )}
    </tr>
  );
}
