"use client";

import Link from "next/link";
import { BadgeCheck, ChevronRight, Play, Radio } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";

type Top = Record<string, unknown> & { kind: string };

const ETIQUETTE: Record<string, string> = {
  artist: "Artiste",
  song: "Titre",
  album: "Album",
  playlist: "Playlist",
  genre: "Genre",
  event: "Évènement",
  user: "Profil",
};

/**
 * « Résultat principal » : la réponse la plus probable à la saisie, isolée
 * en haut de page.
 *
 * Sans elle, chercher un artiste précis oblige à parcourir une section
 * « Artistes » qui ne contient qu'une carte de la taille de toutes les
 * autres. Le résultat principal dit d'emblée : c'est lui que tu cherchais.
 */
export function TopResult({ top, onPlay }: { top: Top; onPlay?: () => void }) {
  const kind = top.kind;

  const titre = String(top.title ?? top.stageName ?? top.name ?? "");
  const cover = (top.coverUrl as string | undefined) ?? (top.avatarUrl as string | undefined);
  const rond = kind === "artist" || kind === "user";

  const lien =
    kind === "artist"
      ? `/artiste/${top._id}`
      : kind === "song"
        ? `/son/${top._id}`
        : kind === "album"
          ? `/album/${top._id}`
          : kind === "playlist"
            ? `/playlist/${top._id}`
            : kind === "event"
              ? `/evenements/${top._id}`
              : kind === "genre"
                ? `/recherche?q=${encodeURIComponent(titre)}&type=songs&genre=${encodeURIComponent(titre)}`
                : null;

  const artiste = top.artist as { stageName?: string; verified?: boolean } | null | undefined;
  const sousTitre = (() => {
    switch (kind) {
      case "artist": {
        const genres = (top.genres as string[] | undefined)?.slice(0, 3).join(" · ");
        const abonnes = (top.followers as unknown[] | undefined)?.length ?? 0;
        return [genres, abonnes ? `${abonnes} abonné${abonnes > 1 ? "s" : ""}` : null].filter(Boolean).join(" — ");
      }
      case "song":
        return artiste?.stageName ?? "Artiste supprimé";
      case "album":
        return artiste?.stageName ?? "Album";
      case "playlist": {
        const n = (top.songs as unknown[] | undefined)?.length ?? 0;
        const owner = top.owner as { name?: string } | null | undefined;
        return [owner?.name, `${n} titre${n > 1 ? "s" : ""}`].filter(Boolean).join(" · ");
      }
      case "genre": {
        const n = Number(top.count ?? 0);
        return `${n} titre${n > 1 ? "s" : ""} dans le catalogue`;
      }
      default:
        return "";
    }
  })();

  const verifie = Boolean(top.verified ?? artiste?.verified);

  return (
    <section className="mb-9">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">Résultat principal</h2>

      <div className="flex flex-col gap-4 rounded-xl2 border border-border bg-surface p-4 sm:flex-row sm:items-center sm:p-5">
        {kind === "genre" ? (
          <span className="grid h-20 w-20 shrink-0 place-items-center rounded-xl2 bg-accent/12 text-accent sm:h-24 sm:w-24">
            <Radio size={30} />
          </span>
        ) : (
          <SafeImage
            src={cover}
            alt={titre}
            width={112}
            height={112}
            className={`h-20 w-20 shrink-0 object-cover shadow-lg sm:h-28 sm:w-28 ${rond ? "rounded-full" : "rounded-xl2"}`}
          />
        )}

        <div className="min-w-0 flex-1">
          <span className="inline-block rounded-full bg-accent/12 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
            {ETIQUETTE[kind] ?? "Résultat"}
          </span>
          <h3 className="mt-1.5 flex items-center gap-1.5 text-xl font-display text-ink sm:text-2xl">
            <span className="truncate">{titre}</span>
            {verifie && <BadgeCheck size={17} className="shrink-0 text-verified" />}
          </h3>
          {sousTitre && <p className="mt-0.5 truncate text-sm text-ink-muted">{sousTitre}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {onPlay && (
            <button
              onClick={onPlay}
              className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
            >
              <Play size={15} fill="currentColor" /> Écouter
            </button>
          )}
          {lien && (
            <Link
              href={lien}
              className="flex items-center gap-1 rounded-full border border-border px-4 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"
            >
              Ouvrir <ChevronRight size={14} />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
