"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SongRow } from "@/components/music/SongRow";
import {
  CarteAlbum,
  CarteArtiste,
  CarteEvenement,
  CarteGenre,
  CartePlaylist,
  CarteUtilisateur,
  type AlbumResultat,
  type ArtisteResultat,
  type EvenementResultat,
  type GenreResultat,
  type PlaylistResultat,
  type UtilisateurResultat,
} from "@/components/search/cards";
import type { PlayableSong } from "@/context/PlayerProvider";

export type SectionRecherche = {
  key: string;
  title: string;
  kind: "song" | "artist" | "album" | "playlist" | "event" | "user" | "genre";
  items: Record<string, unknown>[];
  total: number;
  voirTout?: string;
  disposition: "liste" | "grille" | "carrousel";
  tronque?: boolean;
};

/**
 * Une section de résultats.
 *
 * Chaque section est autonome : elle porte son titre, son total, son
 * éventuel « Voir tout », et choisit sa disposition. Les carrousels
 * défilent horizontalement — c'est la seule façon de montrer huit albums
 * sans repousser les sections suivantes hors de l'écran.
 */
export function SectionResultats({
  section,
  requete,
  onVoirTout,
}: {
  section: SectionRecherche;
  requete: string;
  onVoirTout?: (type: string) => void;
}) {
  const piste = useRef<HTMLDivElement>(null);

  if (section.items.length === 0) return null;

  const reste = section.total - section.items.length;
  const totalAffiche = section.tronque ? `${section.total}+` : String(section.total);

  function defiler(sens: 1 | -1) {
    const el = piste.current;
    if (!el) return;
    el.scrollBy({ left: sens * Math.max(240, el.clientWidth * 0.8), behavior: "smooth" });
  }

  return (
    <section className="mb-9">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="font-display text-lg text-ink">
          {section.title}
          {section.total > 1 && <span className="ml-2 text-sm font-normal text-ink-muted">{totalAffiche}</span>}
        </h2>

        <div className="flex shrink-0 items-center gap-1">
          {section.disposition === "carrousel" && section.items.length > 2 && (
            <span className="hidden items-center gap-1 md:flex">
              <button
                onClick={() => defiler(-1)}
                aria-label="Faire défiler vers la gauche"
                className="grid h-7 w-7 place-items-center rounded-full border border-border text-ink-muted transition-colors hover:border-accent hover:text-accent"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => defiler(1)}
                aria-label="Faire défiler vers la droite"
                className="grid h-7 w-7 place-items-center rounded-full border border-border text-ink-muted transition-colors hover:border-accent hover:text-accent"
              >
                <ChevronRight size={14} />
              </button>
            </span>
          )}
          {section.voirTout && onVoirTout && reste > 0 && (
            <button
              onClick={() => onVoirTout(section.voirTout as string)}
              className="rounded-full px-3 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
            >
              Voir tout
            </button>
          )}
        </div>
      </div>

      {section.kind === "song" ? (
        <div className="space-y-1">
          {(section.items as unknown as PlayableSong[]).map((song, index) => (
            <SongRow
              key={song._id}
              song={song}
              queue={section.items as unknown as PlayableSong[]}
              index={index}
              source={{ type: "search", label: `« ${requete} » — ${section.title}` }}
            />
          ))}
        </div>
      ) : section.kind === "genre" ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(section.items as unknown as GenreResultat[]).map((g) => (
            <CarteGenre key={g._id} genre={g} />
          ))}
        </div>
      ) : (
        <div
          ref={piste}
          className={
            section.disposition === "grille"
              ? "grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6"
              : "flex gap-1 overflow-x-auto pb-1 [scrollbar-width:thin]"
          }
        >
          {section.items.map((item) => (
            <Element key={String(item._id)} kind={section.kind} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function Element({ kind, item }: { kind: SectionRecherche["kind"]; item: Record<string, unknown> }) {
  switch (kind) {
    case "artist":
      return <CarteArtiste artiste={item as unknown as ArtisteResultat} />;
    case "album":
      return <CarteAlbum album={item as unknown as AlbumResultat} />;
    case "playlist":
      return <CartePlaylist playlist={item as unknown as PlaylistResultat} />;
    case "event":
      return <CarteEvenement evenement={item as unknown as EvenementResultat} />;
    case "user":
      return <CarteUtilisateur utilisateur={item as unknown as UtilisateurResultat} />;
    default:
      return null;
  }
}
