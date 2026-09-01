"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Play } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { usePlayer, type PlayableSong } from "@/context/PlayerProvider";
import { useFuseauHoraire } from "@/context/SiteConfigProvider";
import { heure, jourLong } from "@/components/events/eventPresentation";

type HeroArtist = { _id: string; stageName: string; verified?: boolean; coverUrl?: string };

export type HeroSlide = {
  source: "pinned" | "new_release" | "popular" | "playlist" | "event";
  contentType: "song" | "album" | "artist" | "playlist" | "event" | "custom";
  song?: PlayableSong;
  album?: { _id: string; title: string; coverUrl: string; artist: HeroArtist | null };
  artist?: HeroArtist;
  playlist?: { _id: string; title: string; coverUrl?: string; songs: string[] };
  event?: {
    _id: string;
    title: string;
    coverUrl?: string;
    location: string;
    city?: string;
    date: string;
  };
  custom?: { title: string; subtitle?: string; coverUrl?: string; href: string };
};

const LIBELLE_SOURCE: Record<HeroSlide["source"], string> = {
  pinned: "À la une",
  new_release: "Nouvelle sortie",
  popular: "Le plus populaire",
  playlist: "Playlist tendance",
  event: "Évènement à venir",
};

/** Distance minimale d'un glissement pour valoir un changement de diapositive. */
const SEUIL_GLISSEMENT = 50;

/** Défilement automatique — assez lent pour laisser le temps de lire. */
const DELAI_AUTO = 7000;

/**
 * Bandeau d'accueil défilant.
 *
 * Une seule bannière ne pouvait montrer qu'un contenu : les évènements
 * épinglés n'y apparaissaient jamais tant qu'un titre y était. Le
 * carrousel les fait tous passer, musique et évènements mêlés, dans
 * l'ordre décidé par l'administration.
 *
 * Le défilement se fait au doigt, à la flèche du clavier ou aux boutons ;
 * l'avance automatique s'interrompt dès qu'on interagit, et ne reprend
 * pas — reprendre le défilement sous le doigt de quelqu'un qui lit est la
 * façon la plus sûre de lui faire rater ce qu'il regardait.
 */
export function HeroCarousel({
  slides,
  relatedSongs = [],
}: {
  slides: HeroSlide[];
  relatedSongs?: PlayableSong[];
}) {
  const { playQueue } = usePlayer();
  const fuseau = useFuseauHoraire();

  const [index, setIndex] = useState(0);
  const [autoActif, setAutoActif] = useState(true);
  const depart = useRef<number | null>(null);
  const [decalage, setDecalage] = useState(0);

  const total = slides.length;

  const aller = useCallback(
    (cible: number) => {
      if (total === 0) return;
      // Modulo positif : reculer depuis la première ramène à la dernière.
      setIndex(((cible % total) + total) % total);
    },
    [total]
  );

  useEffect(() => {
    if (!autoActif || total <= 1) return;
    const minuteur = setTimeout(() => aller(index + 1), DELAI_AUTO);
    return () => clearTimeout(minuteur);
  }, [autoActif, index, total, aller]);

  function interagir(action: () => void) {
    setAutoActif(false);
    action();
  }

  function debutGlissement(x: number) {
    depart.current = x;
    setAutoActif(false);
  }

  function pendantGlissement(x: number) {
    if (depart.current === null) return;
    setDecalage(x - depart.current);
  }

  function finGlissement() {
    if (depart.current === null) return;
    if (Math.abs(decalage) > SEUIL_GLISSEMENT) aller(index + (decalage < 0 ? 1 : -1));
    depart.current = null;
    setDecalage(0);
  }

  if (total === 0) return null;

  return (
    <section
      aria-roledescription="carrousel"
      aria-label="À la une"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") interagir(() => aller(index + 1));
        if (e.key === "ArrowLeft") interagir(() => aller(index - 1));
      }}
      tabIndex={0}
      className="relative overflow-hidden rounded-xl2 border border-border outline-none focus-visible:border-accent"
    >
      {/* La piste porte toutes les diapositives côte à côte et se translate :
          une seule animation, plutôt qu'un fondu par diapositive. */}
      <div
        className="flex touch-pan-y"
        style={{
          transform: `translateX(calc(-${index * 100}% + ${decalage}px))`,
          transition: depart.current === null ? "transform 420ms cubic-bezier(0.4, 0, 0.2, 1)" : "none",
        }}
        onTouchStart={(e) => debutGlissement(e.touches[0].clientX)}
        onTouchMove={(e) => pendantGlissement(e.touches[0].clientX)}
        onTouchEnd={finGlissement}
        onPointerDown={(e) => e.pointerType === "mouse" && debutGlissement(e.clientX)}
        onPointerMove={(e) => e.pointerType === "mouse" && pendantGlissement(e.clientX)}
        onPointerUp={(e) => e.pointerType === "mouse" && finGlissement()}
        onPointerLeave={(e) => e.pointerType === "mouse" && finGlissement()}
      >
        {slides.map((slide, i) => (
          <Diapositive
            key={i}
            slide={slide}
            actif={i === index}
            fuseau={fuseau}
            relatedSongs={relatedSongs}
            onPlay={playQueue}
          />
        ))}
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={() => interagir(() => aller(index - 1))}
            aria-label="Diapositive précédente"
            className="absolute left-3 top-1/2 hidden -translate-y-1/2 place-items-center rounded-full bg-black/40 p-2.5 text-white backdrop-blur-sm transition-colors hover:bg-black/60 sm:grid"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => interagir(() => aller(index + 1))}
            aria-label="Diapositive suivante"
            className="absolute right-3 top-1/2 hidden -translate-y-1/2 place-items-center rounded-full bg-black/40 p-2.5 text-white backdrop-blur-sm transition-colors hover:bg-black/60 sm:grid"
          >
            <ChevronRight size={18} />
          </button>

          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => interagir(() => aller(i))}
                aria-label={`Aller à la diapositive ${i + 1}`}
                aria-current={i === index}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Diapositive({
  slide,
  actif,
  fuseau,
  relatedSongs,
  onPlay,
}: {
  slide: HeroSlide;
  actif: boolean;
  fuseau?: string;
  relatedSongs: PlayableSong[];
  onPlay: ReturnType<typeof usePlayer>["playQueue"];
}) {
  const cover =
    slide.song?.coverUrl ??
    slide.album?.coverUrl ??
    slide.artist?.coverUrl ??
    slide.playlist?.coverUrl ??
    slide.event?.coverUrl ??
    slide.custom?.coverUrl;

  const titre =
    slide.song?.title ??
    slide.album?.title ??
    slide.artist?.stageName ??
    slide.playlist?.title ??
    slide.event?.title ??
    slide.custom?.title ??
    "";

  const sousTitre = slide.song
    ? slide.song.artist?.stageName ?? "Artiste supprimé"
    : slide.album
    ? slide.album.artist?.stageName ?? "Artiste supprimé"
    : slide.artist
    ? "Artiste en vedette"
    : slide.playlist
    ? `${slide.playlist.songs.length} titres`
    : slide.custom
    ? slide.custom.subtitle ?? ""
    : "";

  const lien = slide.song
    ? `/son/${slide.song._id}`
    : slide.album
    ? `/album/${slide.album._id}`
    : slide.artist
    ? `/artiste/${slide.artist._id}`
    : slide.playlist
    ? `/playlist/${slide.playlist._id}`
    : slide.event
    ? `/evenements/${slide.event._id}`
    : slide.custom
    ? slide.custom.href
    : "/";

  function lancer() {
    if (!slide.song) return;
    const liste = relatedSongs.some((s) => s._id === slide.song!._id)
      ? relatedSongs
      : [slide.song, ...relatedSongs];
    const position = liste.findIndex((s) => s._id === slide.song!._id);
    onPlay(liste, position !== -1 ? position : 0, { type: "home", label: "Accueil" });
  }

  return (
    <article
      // `aria-hidden` sur les diapositives hors écran : sans lui, un
      // lecteur d'écran annoncerait les six titres à la suite comme s'ils
      // étaient tous affichés.
      aria-hidden={!actif}
      className="relative w-full shrink-0 select-none overflow-hidden"
    >
      <div className="absolute inset-0">
        <SafeImage
          src={cover}
          alt=""
          width={1600}
          height={640}
          priority={actif}
          className="h-full w-full object-cover"
        />
        {/* Dégradé plus large en bas qu'à droite : sur mobile le texte
            passe sous l'image, sur grand écran il reste à sa gauche. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/20 md:bg-gradient-to-r md:from-black/90 md:via-black/55 md:to-transparent" />
      </div>

      {/* Hauteur croissante avec l'écran : l'affiche mérite d'être vue,
          et un bandeau de 280 px la réduisait à une bande. */}
      <div className="relative flex min-h-[340px] flex-col justify-end gap-3 px-5 pb-14 pt-8 sm:min-h-[400px] sm:px-8 md:min-h-[440px] md:max-w-xl md:justify-center md:pb-12 lg:min-h-[480px] lg:px-12">
        <span className="w-fit rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {LIBELLE_SOURCE[slide.source]}
        </span>

        <h2 className="font-display text-2xl leading-tight text-white sm:text-3xl lg:text-4xl">{titre}</h2>

        {slide.event ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/75">
            <span className="flex items-center gap-1.5">
              <CalendarDays size={14} />
              {jourLong(slide.event.date, fuseau)} • {heure(slide.event.date, fuseau)}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin size={14} />
              {[slide.event.location, slide.event.city].filter(Boolean).join(", ")}
            </span>
          </div>
        ) : (
          sousTitre && <p className="text-sm text-white/75">{sousTitre}</p>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          {slide.song ? (
            <button
              type="button"
              onClick={lancer}
              // Hors écran, la diapositive ne doit pas être atteignable au
              // clavier : la tabulation traverserait six boutons invisibles.
              tabIndex={actif ? 0 : -1}
              className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
            >
              <Play size={16} fill="currentColor" /> Écouter maintenant
            </button>
          ) : (
            <Link
              href={lien}
              tabIndex={actif ? 0 : -1}
              className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
            >
              {slide.event ? "Voir l'évènement" : "Découvrir"}
            </Link>
          )}

          {slide.song && (
            <Link
              href={lien}
              tabIndex={actif ? 0 : -1}
              className="rounded-full border border-white/25 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              Voir la fiche
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
