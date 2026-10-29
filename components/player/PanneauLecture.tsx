"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, ListMusic, Play, X } from "lucide-react";
import { usePlayer, type PlayableSong } from "@/context/PlayerProvider";
import { useSidebar } from "@/context/SidebarProvider";
import { SafeImage } from "@/components/ui/SafeImage";
import { EqualizerLoader } from "@/components/ui/EqualizerLoader";

/**
 * Le panneau « En cours de lecture », à droite sur un grand écran, comme
 * sur Spotify : la pochette en grand, l'artiste (photo, abonnés,
 * présentation), les crédits du titre et ce qui vient ensuite. Il reste
 * visible pendant qu'on parcourt le site, là où le lecteur plein écran
 * couvre tout.
 *
 * Comme la barre latérale, l'élément `aside` ne fait que réserver la
 * largeur dans la page ; le panneau est fixé aux bords de l'écran, du haut
 * jusqu'au lecteur.
 */

type Artiste = { _id: string; stageName: string; bio?: string; coverUrl?: string; bannerUrl?: string; verified?: boolean; followersCount: number };
type Details = {
  composer?: string;
  producer?: string;
  genre?: string;
  releaseDate?: string;
  album?: { _id: string; title: string } | null;
  featuring?: { artist: { _id: string; stageName: string } | null }[];
};

const LARGEUR = "w-80";

export function PanneauLecture() {
  const { currentSong, queue, isPlaying, playQueue, playSource } = usePlayer();
  const { panneauLecture, basculerPanneauLecture } = useSidebar();
  const [artiste, setArtiste] = useState<Artiste | null>(null);
  const [details, setDetails] = useState<Details | null>(null);

  const artisteId = currentSong?.artist?._id;
  const titreId = currentSong?._id;
  const visible = panneauLecture && !!currentSong;

  // L'artiste et les crédits, redemandés au changement de titre seulement,
  // et seulement si le panneau est ouvert.
  useEffect(() => {
    if (!visible || !artisteId) return setArtiste(null);
    const controleur = new AbortController();
    fetch(`/api/artists/${artisteId}?resume=1`, { signal: controleur.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setArtiste(d?.artist ?? null))
      .catch(() => {});
    return () => controleur.abort();
  }, [visible, artisteId]);

  useEffect(() => {
    if (!visible || !titreId) return setDetails(null);
    const controleur = new AbortController();
    fetch(`/api/songs/${titreId}`, { signal: controleur.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setDetails(d?.song ?? null))
      .catch(() => {});
    return () => controleur.abort();
  }, [visible, titreId]);

  if (!visible || !currentSong) return null;

  const index = queue.findIndex((t) => t._id === currentSong._id);
  const suivants: PlayableSong[] = index >= 0 ? queue.slice(index + 1, index + 4) : [];
  const credits = [
    currentSong.artist && { role: "Interprète", nom: currentSong.artist.stageName },
    ...(details?.featuring ?? []).filter((f) => f.artist).map((f) => ({ role: "Invité", nom: f.artist!.stageName })),
    details?.composer && { role: "Composition", nom: details.composer },
    details?.producer && { role: "Production", nom: details.producer },
  ].filter(Boolean) as { role: string; nom: string }[];

  return (
    <aside className={`print:hidden hidden shrink-0 xl:block ${LARGEUR}`} aria-label="En cours de lecture">
      <div className={`fixed bottom-[var(--hauteur-lecteur,0px)] right-0 top-0 z-10 flex p-2 pl-0 ${LARGEUR}`}>
        <div className="flex min-h-0 w-full flex-col overflow-y-auto rounded-panneau bg-base [scrollbar-width:thin]">
          <div className="sticky top-0 z-10 flex items-center gap-2 bg-base/95 px-4 py-3 backdrop-blur">
            <p className="min-w-0 flex-1 truncate text-sm font-bold">{playSource?.label ?? "En cours de lecture"}</p>
            <button
              type="button"
              onClick={basculerPanneauLecture}
              aria-label="Masquer le panneau de lecture"
              title="Masquer"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-ink/[0.08] hover:text-ink"
            >
              <X size={16} />
            </button>
          </div>

          <div key={currentSong._id} className="space-y-6 px-4 pb-5 animate-fade-in-up">
            <div>
              <SafeImage
                src={currentSong.coverUrl}
                alt={currentSong.title}
                width={288}
                height={288}
                className="aspect-square w-full rounded-md object-cover shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
              />
              <div className="mt-4 flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <Link href={`/son/${currentSong._id}`} className="line-clamp-2 font-display text-xl font-bold leading-tight hover:underline">
                    {currentSong.title}
                  </Link>
                  {currentSong.artist && (
                    <Link href={`/artiste/${currentSong.artist._id}`} className="mt-0.5 block truncate text-sm text-ink-muted hover:text-ink hover:underline">
                      {currentSong.artist.stageName}
                    </Link>
                  )}
                </div>
                {isPlaying && (
                  <span className="mt-1.5 shrink-0">
                    <EqualizerLoader size="sm" />
                  </span>
                )}
              </div>
            </div>

            {artiste && (
              <section className="overflow-hidden rounded-lg bg-ink/[0.06]">
                <div className="relative h-36">
                  <SafeImage
                    src={artiste.bannerUrl || artiste.coverUrl}
                    alt=""
                    width={320}
                    height={144}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <p className="absolute left-3 top-3 text-xs font-bold text-white">À propos de l&apos;artiste</p>
                </div>
                <div className="space-y-2 p-4">
                  <Link href={`/artiste/${artiste._id}`} className="flex items-center gap-1.5 font-bold hover:underline">
                    {artiste.stageName}
                    {artiste.verified && <BadgeCheck size={15} className="shrink-0 text-verified" />}
                  </Link>
                  <p className="text-sm text-ink-muted">
                    {artiste.followersCount.toLocaleString("fr-FR")} abonné{artiste.followersCount > 1 ? "s" : ""}
                  </p>
                  {artiste.bio && <p className="line-clamp-4 text-sm leading-relaxed text-ink-muted">{artiste.bio}</p>}
                </div>
              </section>
            )}

            {credits.length > 0 && (
              <section className="rounded-lg bg-ink/[0.06] p-4">
                <h3 className="mb-3 font-bold">Crédits</h3>
                <dl className="space-y-2.5">
                  {credits.map((c, i) => (
                    <div key={`${c.role}-${i}`}>
                      <dt className="text-sm font-medium text-ink">{c.nom}</dt>
                      <dd className="text-xs text-ink-muted">{c.role}</dd>
                    </div>
                  ))}
                </dl>
                {details?.album && (
                  <p className="mt-3 border-t border-border pt-3 text-xs text-ink-muted">
                    Extrait de{" "}
                    <Link href={`/album/${details.album._id}`} className="font-medium text-ink hover:underline">
                      {details.album.title}
                    </Link>
                  </p>
                )}
              </section>
            )}

            {suivants.length > 0 && (
              <section className="rounded-lg bg-ink/[0.06] p-4">
                <h3 className="mb-2 flex items-center gap-2 font-bold">
                  <ListMusic size={15} className="text-ink-muted" />
                  Ensuite dans la file
                </h3>
                <ul>
                  {suivants.map((t) => (
                    <li key={t._id}>
                      <button
                        type="button"
                        onClick={() => playQueue(queue, queue.indexOf(t), playSource)}
                        className="group flex w-full items-center gap-3 rounded-md p-1.5 text-left transition-colors hover:bg-ink/[0.08]"
                      >
                        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded">
                          <SafeImage src={t.coverUrl} alt="" width={40} height={40} className="h-full w-full object-cover" />
                          <span className="absolute inset-0 hidden place-items-center bg-black/50 text-white group-hover:grid">
                            <Play size={14} fill="currentColor" />
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{t.title}</span>
                          <span className="block truncate text-xs text-ink-muted">{t.artist?.stageName}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
