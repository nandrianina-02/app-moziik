"use client";

import Link from "next/link";
import { BadgeCheck, CalendarDays } from "lucide-react";
import type { PlayableSong } from "@/context/PlayerProvider";
import { SafeImage } from "@/components/ui/SafeImage";
import { SongCard } from "@/components/home/SongCard";
import { GenreTiles } from "@/components/home/GenreTiles";
import { PlaylistGrid } from "@/components/home/PlaylistGrid";
import { AlbumGrid } from "@/components/home/AlbumGrid";
import { CustomCollection } from "@/components/home/CustomCollection";
import { ForYouCarousel, type HubCard } from "@/components/home/ForYouCarousel";
import { RecentlyPlayedRow } from "@/components/home/RecentlyPlayedRow";
import { SectionHeader } from "@/components/home/SectionHeader";
import { SECTION_SEE_ALL, SECTION_SUBTITLE } from "@/components/home/sectionMeta";

export type SectionPayload = { key: string; title: string; data: unknown };

type ArtistCard = { _id: string; stageName: string; verified?: boolean; coverUrl?: string; followersCount: number };
type EventCardData = { _id: string; title: string; coverUrl?: string; date: string };

/**
 * Rendu d'une section éditoriale, quelle que soit la page qui l'accueille.
 *
 * Extrait de la page d'accueil pour être partagé avec les autres groupes
 * de pages (voir components/home/PageSections.tsx) : une section
 * « Nouveautés » doit s'afficher exactement pareil sur l'accueil et sur
 * Découvrir, sinon la configuration de l'admin donnerait un résultat
 * différent selon l'endroit.
 *
 * Renvoie `null` sur une section vide : mieux vaut pas de bloc du tout
 * qu'un titre suivi d'un espace blanc.
 */
export function SectionBlock({ section, sourceLabel = "home" }: { section: SectionPayload; sourceLabel?: string }) {
  function body() {
    switch (section.key) {
      case "for_you": {
        const cards = section.data as HubCard[];
        if (!cards?.length) return null;
        // Ce bloc porte déjà son propre titre.
        return <ForYouCarousel title={section.title} cards={cards} />;
      }
      case "recently_played": {
        const songs = section.data as PlayableSong[];
        if (songs.length === 0) return null;
        return <RecentlyPlayedRow songs={songs} />;
      }
      case "new_releases":
      case "recommendations":
      case "top_tracks": {
        const songs = section.data as PlayableSong[];
        if (songs.length === 0) return null;
        return (
          <div className="stagger grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {songs.map((song, index) => (
              <SongCard
                key={song._id}
                song={song}
                queue={songs}
                index={index}
                source={{ type: "home", label: section.title }}
              />
            ))}
          </div>
        );
      }
      case "genres": {
        const genres = section.data as { genre: string; count: number }[];
        if (genres.length === 0) return null;
        return <GenreTiles genres={genres} />;
      }
      case "playlists": {
        const playlists = section.data as { _id: string; title: string; coverUrl?: string; songsCount: number }[];
        if (playlists.length === 0) return null;
        return <PlaylistGrid playlists={playlists} />;
      }
      case "albums": {
        const albums = section.data as {
          _id: string;
          title: string;
          coverUrl: string;
          artist: { stageName: string; verified?: boolean };
        }[];
        if (albums.length === 0) return null;
        return <AlbumGrid albums={albums} />;
      }
      case "trending_artists": {
        const artists = section.data as ArtistCard[];
        if (!artists?.length) return null;
        return <ArtistRow artists={artists} />;
      }
      case "events": {
        const events = (section.data as { events?: EventCardData[] })?.events ?? [];
        if (events.length === 0) return null;
        return <EventRow events={events} />;
      }
      case "custom": {
        const items = section.data as {
          _id: string;
          contentType: "song" | "album" | "artist" | "playlist" | "event";
          title: string;
          coverUrl?: string;
          href: string;
        }[];
        if (items.length === 0) return null;
        return <CustomCollection items={items} />;
      }
      // `radio`, `premium`, `activity` et `hero` ont un rendu propre à
      // l'accueil (carte latérale, bannière) : ils n'ont pas de forme
      // générique et sont ignorés ailleurs.
      default:
        return null;
    }
  }

  const content = body();
  if (!content) return null;
  if (section.key === "for_you") return <>{content}</>;

  return (
    <section id={`${sourceLabel}-${section.key}`}>
      <SectionHeader
        title={section.title}
        subtitle={SECTION_SUBTITLE[section.key]}
        seeAllHref={SECTION_SEE_ALL[section.key]}
      />
      {content}
    </section>
  );
}

function ArtistRow({ artists }: { artists: ArtistCard[] }) {
  return (
    <div className="stagger grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
      {artists.map((artist) => (
        <Link key={artist._id} href={`/artiste/${artist._id}`} className="group text-center">
          <SafeImage
            src={artist.coverUrl}
            alt={artist.stageName}
            width={96}
            height={96}
            className="mx-auto aspect-square w-full rounded-full object-cover transition-transform group-hover:scale-105"
          />
          <p className="mt-2 flex items-center justify-center gap-1 truncate text-xs font-medium">
            <span className="truncate">{artist.stageName}</span>
            {artist.verified && <BadgeCheck size={11} className="shrink-0 text-verified" />}
          </p>
          <p className="truncate text-[11px] text-ink-muted">{artist.followersCount} abonnés</p>
        </Link>
      ))}
    </div>
  );
}

function EventRow({ events }: { events: EventCardData[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <Link
          key={event._id}
          href="/evenements"
          className="flex items-center gap-3 rounded-xl2 border border-border bg-surface px-4 py-3 transition-colors hover:border-accent"
        >
          <SafeImage src={event.coverUrl} alt="" width={44} height={44} className="shrink-0 rounded-lg object-cover" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{event.title}</span>
            <span className="flex items-center gap-1 text-xs text-ink-muted">
              <CalendarDays size={11} />
              {new Date(event.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
