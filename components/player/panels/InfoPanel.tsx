"use client";

import Link from "next/link";
import {
  BadgeCheck,
  CalendarDays,
  Clock,
  Disc3,
  Gauge,
  Globe,
  Heart,
  Music2,
  Play,
  Share2,
  Tag,
} from "lucide-react";
import type { SongDetails } from "@/components/player/hooks/useSongDetails";
import type { PlayableSong } from "@/context/PlayerProvider";

function duree(secondes: number) {
  if (!Number.isFinite(secondes) || secondes <= 0) return "—";
  const m = Math.floor(secondes / 60);
  const s = Math.floor(secondes % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function annee(date?: string) {
  if (!date) return null;
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? null : d.getFullYear();
}

function dateLongue(date?: string) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function Fiche({
  icon: Icon,
  label,
  valeur,
}: {
  icon: typeof Clock;
  label: string;
  valeur: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface/60 px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
        <Icon size={11} /> {label}
      </span>
      <span className="mt-1 block truncate text-sm text-ink">{valeur}</span>
    </div>
  );
}

/**
 * Onglet « Informations ».
 *
 * `details` vient de /api/songs/[id] et peut manquer (hors-ligne sans
 * cache) : on retombe alors sur ce que la file d'attente connaît déjà,
 * plutôt que d'afficher un panneau vide.
 */
export function InfoPanel({ song, details }: { song: PlayableSong; details: SongDetails | null }) {
  const album =
    details?.album ??
    (typeof song.album === "object" && song.album ? { _id: song.album._id, title: song.album.title } : null);
  const genre = details?.genre ?? song.genre;
  const sortie = details?.releaseDate ?? song.releaseDate;
  const ecoutes = details?.playsCount ?? song.playsCount;
  const favoris = details?.likesCount ?? song.likesCount;

  return (
    <div className="space-y-4 pb-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Fiche
          icon={Disc3}
          label="Album"
          valeur={
            album ? (
              <Link href={`/album/${album._id}`} className="text-accent hover:underline">
                {album.title}
              </Link>
            ) : (
              "Single"
            )
          }
        />
        <Fiche
          icon={Music2}
          label="Genre"
          valeur={
            genre ? (
              <Link href={`/recherche?q=${encodeURIComponent(genre)}&type=songs`} className="hover:text-accent">
                {genre}
              </Link>
            ) : (
              "—"
            )
          }
        />
        <Fiche icon={CalendarDays} label="Année" valeur={annee(sortie) ?? "—"} />
        <Fiche icon={Clock} label="Durée" valeur={duree(details?.duration ?? song.duration)} />
        {details?.bpm ? <Fiche icon={Gauge} label="Tempo" valeur={`${details.bpm} BPM`} /> : null}
        {details?.musicalKey ? <Fiche icon={Music2} label="Tonalité" valeur={details.musicalKey} /> : null}
        {details?.language ? <Fiche icon={Globe} label="Langue" valeur={details.language} /> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs text-ink-muted">
          <Play size={12} className="text-accent" />
          {(ecoutes ?? 0).toLocaleString("fr-FR")} écoute{(ecoutes ?? 0) > 1 ? "s" : ""}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs text-ink-muted">
          <Heart size={12} className="text-accent" />
          {(favoris ?? 0).toLocaleString("fr-FR")} favori{(favoris ?? 0) > 1 ? "s" : ""}
        </span>
        {typeof details?.sharesCount === "number" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs text-ink-muted">
            <Share2 size={12} className="text-accent" />
            {details.sharesCount.toLocaleString("fr-FR")} partage{details.sharesCount > 1 ? "s" : ""}
          </span>
        )}
        {details?.explicit && (
          <span className="inline-flex items-center rounded-full border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
            Explicite
          </span>
        )}
      </div>

      {details?.tags && details.tags.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
            <Tag size={11} /> Mots-clés
          </p>
          <div className="flex flex-wrap gap-1.5">
            {details.tags.map((tag) => (
              <Link
                key={tag}
                href={`/recherche?q=${encodeURIComponent(tag)}`}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-ink-muted transition-colors hover:border-accent hover:text-accent"
              >
                {tag}
              </Link>
            ))}
          </div>
        </div>
      )}

      {details?.description && (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">À propos</p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">{details.description}</p>
        </div>
      )}

      {song.artist && (
        <Link
          href={`/artiste/${song.artist._id}`}
          className="flex items-center justify-between rounded-xl2 border border-border bg-surface px-4 py-3 transition-colors hover:border-accent"
        >
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Artiste</span>
            <span className="mt-0.5 flex items-center gap-1 truncate text-sm font-medium text-ink">
              {song.artist.stageName}
              {song.artist.verified && <BadgeCheck size={13} className="shrink-0 text-verified" />}
            </span>
          </span>
          <span className="shrink-0 text-xs font-medium text-accent">Voir le profil</span>
        </Link>
      )}

      {dateLongue(sortie) && (
        <p className="text-[11px] text-ink-muted">Sorti le {dateLongue(sortie)}.</p>
      )}
    </div>
  );
}
