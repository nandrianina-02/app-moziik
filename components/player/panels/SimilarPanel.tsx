"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, ListPlus, Play } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { usePlayer, type PlayableSong } from "@/context/PlayerProvider";
import { useToast } from "@/context/ToastProvider";

type TitreProche = PlayableSong & { matchReason?: string };

function duree(secondes: number) {
  if (!Number.isFinite(secondes)) return "0:00";
  const m = Math.floor(secondes / 60);
  const s = Math.floor(secondes % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Onglet « Titres similaires ».
 *
 * La proximité est calculée côté serveur (voir
 * app/api/songs/[id]/similar) et chaque ligne affiche la raison du
 * rapprochement — « Même artiste », « Collaboration », le genre… Sans
 * cette raison, une liste de titres « similaires » ressemble à un tirage
 * au sort.
 */
export function SimilarPanel({ songId }: { songId: string }) {
  const { playQueue, playNextInQueue, currentSong } = usePlayer();
  const pushToast = useToast();
  const [titres, setTitres] = useState<TitreProche[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    fetch(`/api/songs/${songId}/similar`)
      .then((res) => (res.ok ? res.json() : { songs: [] }))
      .then((data) => {
        if (!annule) setTitres(data.songs ?? []);
      })
      .catch(() => {
        if (!annule) setTitres([]);
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [songId]);

  if (chargement) return <SkeletonRows count={5} />;

  if (titres.length === 0) {
    return (
      <p className="rounded-xl2 border border-dashed border-border px-4 py-10 text-center text-sm text-ink-muted">
        Pas encore assez de titres proches dans le catalogue pour proposer une suite.
      </p>
    );
  }

  return (
    <ul className="space-y-1 pb-6">
      {titres.map((titre, index) => (
        <li
          key={titre._id}
          className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface"
        >
          <button
            onClick={() => playQueue(titres, index, { type: "song", label: `Proche de « ${currentSong?.title ?? ""} »` })}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <span className="relative shrink-0">
              <SafeImage
                src={titre.coverUrl}
                alt={titre.title}
                width={40}
                height={40}
                className="h-10 w-10 rounded-lg object-cover"
              />
              <span className="absolute inset-0 grid place-items-center rounded-lg bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                <Play size={14} className="text-white" fill="currentColor" />
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-ink">{titre.title}</span>
              <span className="flex items-center gap-1 truncate text-xs text-ink-muted">
                {titre.artist?.stageName ?? "Artiste supprimé"}
                {titre.artist?.verified && <BadgeCheck size={11} className="shrink-0 text-verified" />}
                {titre.matchReason && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="truncate text-accent">{titre.matchReason}</span>
                  </>
                )}
              </span>
            </span>
          </button>
          <span className="shrink-0 text-xs tabular-nums text-ink-muted">{duree(titre.duration)}</span>
          <button
            onClick={() => {
              playNextInQueue(titre);
              pushToast("success", "Ajouté juste après le morceau en cours.");
            }}
            aria-label="Lire ensuite"
            title="Lire ensuite"
            className="shrink-0 rounded-full p-1.5 text-ink-muted opacity-0 transition-opacity hover:bg-base hover:text-accent focus:opacity-100 group-hover:opacity-100"
          >
            <ListPlus size={15} />
          </button>
        </li>
      ))}
    </ul>
  );
}
