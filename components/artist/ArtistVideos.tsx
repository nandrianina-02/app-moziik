"use client";

import { useState } from "react";
import Link from "next/link";
import { Clapperboard, Play } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { VideoPlayerModal } from "@/components/song/VideoPlayerModal";
import type { PlayableSong } from "@/context/PlayerProvider";

/**
 * Les clips d'un artiste.
 *
 * Une vidéo n'est pas un contenu séparé : c'est un titre du catalogue qui
 * a reçu un clip. La grille n'affiche donc que les morceaux dont
 * `videoUrl` est renseigné, avec la pochette du titre en vignette — ce qui
 * évite de fabriquer des miniatures et garde le lien avec la fiche.
 */

type Clip = PlayableSong & { videoUrl?: string };

export function ArtistVideos({ songs }: { songs: Clip[] }) {
  const clips = songs.filter((s) => Boolean(s.videoUrl));
  const [ouvert, setOuvert] = useState<Clip | null>(null);

  if (clips.length === 0) {
    return (
      <div className="rounded-xl2 border border-dashed border-border p-8 text-center">
        <Clapperboard size={28} className="mx-auto mb-3 text-ink-muted" />
        <p className="text-sm font-medium">Aucun clip pour l&apos;instant</p>
        <p className="mt-1 text-xs text-ink-muted">
          Un clip s&apos;ajoute à un titre depuis sa page de modification.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clips.map((clip) => (
          <article key={clip._id} className="group">
            <button
              type="button"
              onClick={() => setOuvert(clip)}
              aria-label={`Regarder le clip de ${clip.title}`}
              className="relative block w-full overflow-hidden rounded-xl2 bg-base"
            >
              <SafeImage
                src={clip.coverUrl}
                alt=""
                width={480}
                height={270}
                className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <span className="absolute inset-0 grid place-items-center bg-black/0 transition-colors group-hover:bg-black/35">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-black shadow-lg">
                  <Play size={20} fill="currentColor" />
                </span>
              </span>
            </button>

            <h3 className="mt-2.5 truncate text-sm font-medium">
              <Link href={`/son/${clip._id}`} className="transition-colors hover:text-accent">
                {clip.title}
              </Link>
            </h3>
            {clip.releaseDate && (
              <p className="text-xs text-ink-muted">{new Date(clip.releaseDate).getFullYear()}</p>
            )}
          </article>
        ))}
      </div>

      {ouvert?.videoUrl && (
        <VideoPlayerModal
          videoUrl={ouvert.videoUrl}
          titre={ouvert.title}
          sousTitre={ouvert.artist?.stageName}
          href={`/son/${ouvert._id}`}
          onClose={() => setOuvert(null)}
        />
      )}
    </>
  );
}
