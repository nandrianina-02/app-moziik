"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus, Search } from "lucide-react";
import { EqualizerLoader } from "@/components/ui/EqualizerLoader";
import { Reveal } from "@/components/layout/Reveal";
import { useToast } from "@/context/ToastProvider";
import { useSiteConfig } from "@/context/SiteConfigProvider";
import type { PlayableSong } from "@/context/PlayerProvider";
import { HeroBanner } from "@/components/home/HeroBanner";
import { SongCard } from "@/components/home/SongCard";
import { TopTracksList } from "@/components/home/TopTracksList";
import { GenreTiles } from "@/components/home/GenreTiles";
import { PlaylistGrid } from "@/components/home/PlaylistGrid";
import { AlbumGrid } from "@/components/home/AlbumGrid";
import { CustomCollection } from "@/components/home/CustomCollection";
import { ForYouCarousel, type HubCard } from "@/components/home/ForYouCarousel";
import { RecentlyPlayedRow } from "@/components/home/RecentlyPlayedRow";
import { EventsCard, RadioCard, FeaturedArtists, ActivityFeed, SupportArtistsCard } from "@/components/home/HomeSidebar";
import { PremiumBanner } from "@/components/home/PremiumBanner";

type Hero = Parameters<typeof HeroBanner>[0]["hero"] | null;

type Section = { key: string; title: string; data: unknown };

type HomepageData = { hero: Hero; sections: Section[] };

export default function HomePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const pushToast = useToast();
  const siteConfig = useSiteConfig();
  const [homepage, setHomepage] = useState<HomepageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/homepage");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setHomepage(data);
    } catch {
      pushToast("error", "Impossible de charger la page d'accueil.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canPublish = session?.user?.role === "artist" || session?.user?.role === "admin";

  const newReleasesSection = homepage?.sections.find((s) => s.key === "new_releases");
  const newReleasesCount = newReleasesSection ? (newReleasesSection.data as PlayableSong[]).length : 0;

  const eventsSection = homepage?.sections.find((s) => s.key === "events");
  const radioSection = homepage?.sections.find((s) => s.key === "radio");
  const artistsSection = homepage?.sections.find((s) => s.key === "trending_artists");
  const activitySection = homepage?.sections.find((s) => s.key === "activity");

  const mainSections = homepage?.sections.filter(
    (s) => !["events", "radio", "trending_artists", "activity", "premium"].includes(s.key)
  );
  const premiumSection = homepage?.sections.find((s) => s.key === "premium");

  return (
    <div className="px-6 py-8 md:px-10 md:py-10">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display md:text-3xl">Bon retour sur {siteConfig.siteName}</h1>
          <p className="mt-1 text-sm text-ink-muted">{siteConfig.tagline}</p>
        </div>
        {canPublish && (
          <button
            onClick={() => router.push("/son/nouveau")}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-base hover:bg-accent-hover"
          >
            <Plus size={16} /> Publier
          </button>
        )}
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          router.push(searchText.trim() ? `/recherche?q=${encodeURIComponent(searchText.trim())}` : "/recherche");
        }}
        className="mb-8 flex w-full max-w-xl items-center gap-2.5 rounded-full border border-border bg-surface px-4 py-2.5 focus-within:border-accent"
      >
        <Search size={16} className="shrink-0 text-ink-muted" />
        <input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Rechercher un titre, un artiste, un album..."
          className="w-full bg-transparent text-sm text-ink placeholder:text-ink-muted outline-none"
        />
      </form>

      {loading && (
        <div className="grid place-items-center py-16">
          <EqualizerLoader />
        </div>
      )}

      {!loading && homepage && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-10 min-w-0">
            {homepage.hero && (
              <HeroBanner
                hero={homepage.hero}
                newReleasesCount={newReleasesCount}
                relatedSongs={newReleasesSection ? (newReleasesSection.data as PlayableSong[]) : []}
              />
            )}

            {mainSections?.map((section) =>
              section.key === "for_you" ? (
                <Reveal key={section.key}>
                  <ForYouCarousel title={section.title} cards={section.data as HubCard[]} />
                </Reveal>
              ) : (
                <Reveal key={section.key}>
                  <SectionBlock section={section} />
                </Reveal>
              )
            )}
          </div>

          <aside className="space-y-4">
            {eventsSection && <EventsCard upcomingCount={(eventsSection.data as { upcomingCount: number }).upcomingCount} />}
            {radioSection && <RadioCard />}
            {artistsSection && (
              <FeaturedArtists
                artists={
                  artistsSection.data as {
                    _id: string;
                    stageName: string;
                    verified?: boolean;
                    coverUrl?: string;
                    followersCount: number;
                  }[]
                }
              />
            )}
            {activitySection && (
              <ActivityFeed items={activitySection.data as { type: string; message: string; link: string; at: string }[]} />
            )}
            <SupportArtistsCard />
          </aside>
        </div>
      )}

      {!loading && premiumSection && (
        <div className="mt-10">
          <PremiumBanner
            plans={(premiumSection.data as { plans: { plan: "premium" | "premium_annual"; amountUSD: number; amountMGA: number }[] }).plans}
            isSubscriber={(premiumSection.data as { isSubscriber: boolean }).isSubscriber}
          />
        </div>
      )}

    </div>
  );
}

function SectionBlock({ section }: { section: Section }) {
  const seeAllHref: Record<string, string> = {
    new_releases: "/classements",
    top_tracks: "/classements",
    playlists: "/bibliotheque",
    albums: "/classements",
    recommendations: "/recherche",
  };

  function body() {
    switch (section.key) {
      case "recently_played": {
        const songs = section.data as PlayableSong[];
        if (songs.length === 0) return null;
        return <RecentlyPlayedRow songs={songs} />;
      }
      case "new_releases":
      case "recommendations": {
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
      case "top_tracks": {
        const songs = section.data as PlayableSong[];
        if (songs.length === 0) return null;
        return <TopTracksList songs={songs} source={{ type: "chart", label: section.title }} />;
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
      default:
        return null;
    }
  }

  const content = body();
  if (!content) return null;

  return (
    <section id={section.key}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg">{section.title}</h3>
        {seeAllHref[section.key] && (
          <Link href={seeAllHref[section.key]} className="text-xs text-ink-muted hover:text-ink">
            Voir tout
          </Link>
        )}
      </div>
      {content}
    </section>
  );
}
