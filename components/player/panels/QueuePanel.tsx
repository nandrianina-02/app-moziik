"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GripVertical, History, ListMusic, Loader2, MoreVertical, Play, Trash2, X } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { usePlayer, type PlayableSong } from "@/context/PlayerProvider";
import { SongContextMenu } from "@/components/music/SongContextMenu";
import { useLongPress } from "@/components/music/useLongPress";
import { idbGetAll, STORES } from "@/lib/offlineDb";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type EntreeHistorique = {
  localId?: number;
  songId: string;
  title: string;
  artistName: string;
  artistId?: string;
  coverUrl?: string;
  audioUrl?: string;
  duration?: number;
  playedAt: number;
};

type Onglet = "file" | "historique";

export function QueuePanel({ compact = false }: { compact?: boolean }) {
  const [onglet, setOnglet] = useState<Onglet>("file");
  const { queue, reserveCount, clearQueue } = usePlayer();

  return (
    <div className="flex min-h-0 flex-col">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-full bg-base p-0.5">
          <BoutonOnglet actif={onglet === "file"} onClick={() => setOnglet("file")} icon={ListMusic}>
            File{queue.length > 0 ? ` · ${queue.length}` : ""}
          </BoutonOnglet>
          <BoutonOnglet actif={onglet === "historique"} onClick={() => setOnglet("historique")} icon={History}>
            Historique
          </BoutonOnglet>
        </div>

        {onglet === "file" && queue.length > 0 && (
          <button
            onClick={clearQueue}
            className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-ink-muted transition-colors hover:bg-base hover:text-accent"
          >
            <Trash2 size={11} /> Vider
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {onglet === "file" ? <ListeFile compact={compact} /> : <ListeHistorique />}
      </div>

      {/* La file ne contient qu'un lot de dix : sans cette ligne, une playlist
          de deux cents titres aurait l'air de s'arrêter au dixième. */}
      {onglet === "file" && reserveCount > 0 && (
        <p className="shrink-0 pt-2 text-center text-[11px] text-ink-muted">
          + {reserveCount} titre{reserveCount > 1 ? "s" : ""} à suivre, ajoutés dix par dix
        </p>
      )}
    </div>
  );
}

function BoutonOnglet({
  actif,
  onClick,
  icon: Icon,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  icon: typeof ListMusic;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={actif}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
        actif ? "bg-accent text-base" : "text-ink-muted hover:text-ink"
      }`}
    >
      <Icon size={12} /> {children}
    </button>
  );
}

/* ---------------------------------------------------------------- file ---- */

function ListeFile({ compact }: { compact: boolean }) {
  const {
    queue,
    currentSong,
    currentIndex,
    isPlaying,
    playQueue,
    reorderQueue,
    removeFromQueue,
    playSource,
    chargementSuite,
    lectureProlongee,
  } = usePlayer();
  const [menu, setMenu] = useState<{ x: number; y: number; index: number } | null>(null);
  // Index tiré, et index survolé : la ligne survolée s'écarte pour montrer
  // où le morceau atterrira.
  const [tire, setTire] = useState<number | null>(null);
  const [survole, setSurvole] = useState<number | null>(null);

  const terminer = useCallback(() => {
    setTire(null);
    setSurvole(null);
  }, []);

  if (queue.length === 0) {
    return (
      <p className="px-1 py-8 text-center text-sm text-ink-muted">
        La file d&apos;attente est vide. Lance un titre pour la remplir.
      </p>
    );
  }

  return (
    <>
      {playSource?.label && (
        <p className="mb-2 truncate px-1 text-[11px] text-ink-muted">
          Lecture depuis&nbsp;: <span className="text-ink">{playSource.label}</span>
          {/* La file a depasse ce qui avait ete demande : le dire evite de
              laisser croire que ces titres etaient dans l'album ou la
              playlist d'origine. */}
          {lectureProlongee && <span className="text-ink-muted"> · lecture automatique</span>}
        </p>
      )}

      <ul className="space-y-0.5">
        <AnimatePresence initial={false}>
          {queue.map((song, index) => (
            <LigneFile
              key={song._id}
              song={song}
              index={index}
              compact={compact}
              isCurrent={index === currentIndex && song._id === currentSong?._id}
              isPlaying={isPlaying}
              estTire={tire === index}
              estCible={survole === index && tire !== null && tire !== index}
              onPlay={() => playQueue(queue, index)}
              onRemove={() => removeFromQueue(index)}
              onOpenMenu={(x, y) => setMenu({ x, y, index })}
              onDragStart={() => setTire(index)}
              onDragEnter={() => setSurvole(index)}
              onDrop={(depuis) => {
                // `depuis` vient de dataTransfer, pas de l'état React.
                // L'index tiré est bien mémorisé dans `tire` au dragstart,
                // mais si le dépôt survient avant que React n'ait re-rendu,
                // la fermeture de ce gestionnaire voit encore `null` et le
                // déplacement est perdu. Le presse-papier de glissement,
                // lui, est disponible immédiatement.
                const source = Number.isInteger(depuis) ? depuis : tire;
                if (source !== null && source !== index) reorderQueue(source, index);
                terminer();
              }}
              onDragEnd={terminer}
              onDeplacer={(delta) => {
                const cible = index + delta;
                if (cible >= 0 && cible < queue.length) reorderQueue(index, cible);
              }}
            />
          ))}
        </AnimatePresence>
      </ul>

      {chargementSuite && (
        <p className="flex items-center justify-center gap-2 px-1 py-3 text-[11px] text-ink-muted">
          <Loader2 size={12} className="animate-spin" />
          Recherche de la suite…
        </p>
      )}

      {menu && (
        <SongContextMenu song={queue[menu.index]} position={{ x: menu.x, y: menu.y }} onClose={() => setMenu(null)} />
      )}
    </>
  );
}

function LigneFile({
  song,
  index,
  compact,
  isCurrent,
  isPlaying,
  estTire,
  estCible,
  onPlay,
  onRemove,
  onOpenMenu,
  onDragStart,
  onDragEnter,
  onDrop,
  onDragEnd,
  onDeplacer,
}: {
  song: PlayableSong;
  index: number;
  compact: boolean;
  isCurrent: boolean;
  isPlaying: boolean;
  estTire: boolean;
  estCible: boolean;
  onPlay: () => void;
  onRemove: () => void;
  onOpenMenu: (x: number, y: number) => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  /** `depuis` = index tiré, lu dans dataTransfer (NaN si absent). */
  onDrop: (depuis: number) => void;
  onDragEnd: () => void;
  onDeplacer: (delta: number) => void;
}) {
  const longPress = useLongPress((x, y) => onOpenMenu(x, y));

  return (
    <motion.li
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: estTire ? 0.4 : 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
    >
      {/*
        Les gestionnaires de glisser-déposer sont posés sur ce <div> et non
        sur le <motion.li> : framer-motion réserve `onDragStart`/`onDragEnd`
        pour son propre geste de déplacement et ne les transmet pas au DOM.
        Posés sur le li, ils n'auraient jamais été appelés.

        Le glisser-déposer natif suffit ici — aucune dépendance
        supplémentaire — et la poignée reste utilisable au clavier grâce
        aux flèches haut/bas (voir onKeyDown plus bas).
      */}
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", String(index));
          onDragStart();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDragEnter={onDragEnter}
        onDrop={(e) => {
          e.preventDefault();
          onDrop(Number(e.dataTransfer.getData("text/plain")));
        }}
        onDragEnd={onDragEnd}
        onContextMenu={(e) => {
          e.preventDefault();
          onOpenMenu(e.clientX, e.clientY);
        }}
        onTouchStart={longPress.onTouchStart}
        onTouchEnd={longPress.onTouchEnd}
        onTouchMove={longPress.onTouchMove}
        className={`group relative flex items-center gap-2 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-surface ${
          isCurrent ? "bg-accent/10" : ""
        } ${estCible ? "ring-1 ring-accent" : ""}`}
      >
      <button
        aria-label={`Déplacer « ${song.title} » dans la file`}
        title="Glisser pour réordonner (ou flèches haut/bas)"
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            onDeplacer(-1);
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            onDeplacer(1);
          }
        }}
        className="shrink-0 cursor-grab rounded p-0.5 text-ink-muted opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical size={14} />
      </button>

      <button onClick={onPlay} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        {isCurrent ? (
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-base">
            {isPlaying ? (
              <span className="inline-flex h-2.5 items-end gap-[2px]" role="status" aria-label="Lecture en cours">
                <span className="h-full w-[2px] origin-bottom rounded-sm bg-base animate-eq1" />
                <span className="h-full w-[2px] origin-bottom rounded-sm bg-base animate-eq2" />
                <span className="h-full w-[2px] origin-bottom rounded-sm bg-base animate-eq3" />
              </span>
            ) : (
              <Play size={11} fill="currentColor" />
            )}
          </span>
        ) : (
          <span className="w-6 shrink-0 text-center text-xs tabular-nums text-ink-muted">{index + 1}</span>
        )}

        <SafeImage
          src={song.coverUrl}
          alt={song.title}
          width={36}
          height={36}
          className="h-9 w-9 shrink-0 rounded-lg object-cover"
        />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm ${isCurrent ? "font-medium text-accent" : "text-ink"}`}>
            {song.title}
          </span>
          <span className="block truncate text-xs text-ink-muted">{song.artist?.stageName ?? "Artiste supprimé"}</span>
        </span>
      </button>

      <span className="shrink-0 text-xs tabular-nums text-ink-muted">{formatTime(song.duration)}</span>

      <button
        onClick={onRemove}
        aria-label={`Retirer « ${song.title} » de la file`}
        title="Retirer de la file"
        className="shrink-0 rounded-full p-1 text-ink-muted opacity-0 transition-opacity hover:bg-base hover:text-accent focus:opacity-100 group-hover:opacity-100"
      >
        <X size={14} />
      </button>

      {!compact && (
        <button
          onClick={(e) => onOpenMenu(e.clientX, e.clientY)}
          aria-label="Options du son"
          className="shrink-0 rounded-full p-1 text-ink-muted opacity-0 transition-opacity hover:bg-base hover:text-ink focus:opacity-100 group-hover:opacity-100"
        >
          <MoreVertical size={14} />
        </button>
      )}
      </div>
    </motion.li>
  );
}

/* ---------------------------------------------------------- historique ---- */

function ListeHistorique() {
  const { playQueue } = usePlayer();
  const [entrees, setEntrees] = useState<EntreeHistorique[] | null>(null);

  useEffect(() => {
    let annule = false;
    idbGetAll<EntreeHistorique>(STORES.history)
      .then((tout) => {
        if (annule) return;
        // Une même chanson réécoutée plusieurs fois n'apparaît qu'une
        // fois, à sa dernière écoute.
        const parSon = new Map<string, EntreeHistorique>();
        for (const e of [...tout].sort((a, b) => b.playedAt - a.playedAt)) {
          if (!parSon.has(e.songId)) parSon.set(e.songId, e);
        }
        setEntrees([...parSon.values()].slice(0, 60));
      })
      .catch(() => {
        if (!annule) setEntrees([]);
      });
    return () => {
      annule = true;
    };
  }, []);

  if (entrees === null) return <p className="px-1 py-8 text-center text-sm text-ink-muted">Chargement…</p>;
  if (entrees.length === 0) {
    return (
      <p className="px-1 py-8 text-center text-sm text-ink-muted">
        Rien encore ici. L&apos;historique se remplit après 30 secondes d&apos;écoute.
      </p>
    );
  }

  // Les entrées écrites avant l'ajout de la pochette et de l'URL audio
  // n'ont pas de quoi être rejouées : elles restent listées, mais mènent
  // à la page du titre au lieu de lancer la lecture.
  const rejouables = entrees.filter((e) => e.audioUrl);

  return (
    <ul className="space-y-0.5">
      {entrees.map((e) => {
        const peutJouer = !!e.audioUrl;
        const contenu = (
          <>
            <SafeImage
              src={e.coverUrl}
              alt={e.title}
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-lg object-cover"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-ink">{e.title}</span>
              <span className="block truncate text-xs text-ink-muted">
                {e.artistName} · {quandEcoute(e.playedAt)}
              </span>
            </span>
            {e.duration ? (
              <span className="shrink-0 text-xs tabular-nums text-ink-muted">{formatTime(e.duration)}</span>
            ) : null}
          </>
        );

        return (
          <li key={`${e.songId}-${e.playedAt}`} className="rounded-xl transition-colors hover:bg-surface">
            {peutJouer ? (
              <button
                onClick={() => {
                  const liste: PlayableSong[] = rejouables.map((h) => ({
                    _id: h.songId,
                    title: h.title,
                    coverUrl: h.coverUrl ?? "",
                    audioUrl: h.audioUrl as string,
                    duration: h.duration ?? 0,
                    artist: h.artistId ? { _id: h.artistId, stageName: h.artistName } : null,
                  }));
                  const depart = liste.findIndex((s) => s._id === e.songId);
                  playQueue(liste, Math.max(0, depart), { type: "history", label: "Historique d'écoute" });
                }}
                className="flex w-full items-center gap-2.5 px-1.5 py-1.5 text-left"
              >
                {contenu}
              </button>
            ) : (
              <a href={`/son/${e.songId}`} className="flex w-full items-center gap-2.5 px-1.5 py-1.5">
                {contenu}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function quandEcoute(instant: number) {
  const minutes = Math.floor((Date.now() - instant) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  if (jours < 30) return `il y a ${jours} j`;
  return new Date(instant).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
