"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus, Search } from "lucide-react";
import { Reveal } from "@/components/layout/Reveal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/context/ToastProvider";
import { useSiteConfig } from "@/context/SiteConfigProvider";
import type { PlayableSong } from "@/context/PlayerProvider";
import { HeroCarousel, type HeroSlide } from "@/components/home/HeroCarousel";
import { EventsCard, RadioCard, FeaturedArtists, ActivityFeed, SupportArtistsCard } from "@/components/home/HomeSidebar";
import { PremiumBanner } from "@/components/home/PremiumBanner";
import { SectionHeader } from "@/components/home/SectionHeader";
import { TrendingList } from "@/components/home/TrendingList";
import { SectionBlock } from "@/components/home/SectionBlock";
import { HomeSectionSkeleton, HomeSidebarSkeleton } from "@/components/home/HomeSectionSkeleton";
import { useHomepageStream, slotData } from "@/components/home/useHomepageStream";
import { SIDEBAR_SECTION_KEYS } from "@/components/home/sectionMeta";

export default function HomePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const pushToast = useToast();
  const siteConfig = useSiteConfig();
  const [searchText, setSearchText] = useState("");

  // L'accueil se remplit section par section à mesure que le serveur les
  // calcule (voir components/home/useHomepageStream.ts) : la page est
  // dessinée en entier presque tout de suite, chaque bloc remplaçant
  // ensuite son squelette. Auparavant, un seul appel bloquant maintenait
  // l'écran vide jusqu'à ce que la dernière section soit prête.
  const { slots, hero, heroPending, starting, failed } = useHomepageStream();

  useEffect(() => {
    if (failed) pushToast("error", "Impossible de charger la page d'accueil.");
  }, [failed, pushToast]);

  const canPublish = session?.user?.role === "artist" || session?.user?.role === "admin";

  const newReleases = slotData<PlayableSong[]>(slots, "new_releases") ?? [];

  const eventsData = slotData<{ upcomingCount: number }>(slots, "events");
  const radioData = slotData<{ active: boolean }>(slots, "radio");
  const artistsData = slotData<
    { _id: string; stageName: string; verified?: boolean; coverUrl?: string; followersCount: number }[]
  >(slots, "trending_artists");
  const activityData = slotData<{ type: string; message: string; link: string; at: string }[]>(slots, "activity");
  // Le top des titres part en colonne latérale sous forme de classement
  // numéroté : format bien plus lisible qu'une grille pour un palmarès,
  // et cohérent avec les autres plateformes.
  const topTracksSlot = slots.find((s) => s.key === "top_tracks");
  const topTracks = topTracksSlot?.status === "ready" ? (topTracksSlot.data as PlayableSong[]) : undefined;

  const mainSlots = slots.filter((s) => !SIDEBAR_SECTION_KEYS.includes(s.key) && s.key !== "premium");
  // La colonne latérale garde son ordre visuel propre (palmarès en haut,
  // activité en bas) : l'ordre défini par l'admin pilote le flux principal,
  // pas l'empilement de cette colonne.
  const sidebarSlots = slots
    .filter((s) => SIDEBAR_SECTION_KEYS.includes(s.key))
    .sort((a, b) => SIDEBAR_SECTION_KEYS.indexOf(a.key) - SIDEBAR_SECTION_KEYS.indexOf(b.key));
  const premiumData = slotData<{
    plans: { plan: "premium" | "premium_annual"; amountUSD: number; amountMGA: number }[];
    isSubscriber: boolean;
  }>(slots, "premium");

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-8 md:px-10 md:py-10">
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

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-10 min-w-0">
          {heroPending ? (
            <Skeleton
              aria-busy="true"
              className="min-h-[340px] w-full rounded-xl2 sm:min-h-[400px] md:min-h-[440px] lg:min-h-[480px]"
            />
          ) : (
            <HeroCarousel slides={(hero as HeroSlide[] | null) ?? []} relatedSongs={newReleases} />
          )}

          {/* Avant même de connaître la liste des sections (première ligne
              du flux), la page occupe déjà sa place à l'écran. */}
          {starting &&
            ["new_releases", "genres", "albums"].map((key) => (
              <HomeSectionSkeleton key={key} sectionKey={key} title="" />
            ))}

          {mainSlots.map((slot) =>
            slot.status === "ready" ? (
              <Reveal key={slot.key}>
                <SectionBlock section={{ key: slot.key, title: slot.title, data: slot.data }} />
              </Reveal>
            ) : (
              <HomeSectionSkeleton key={slot.key} sectionKey={slot.key} title={slot.title} />
            )
          )}
        </div>

        {/* `lg:sticky` : la colonne latérale suit le défilement de la
            colonne principale, souvent bien plus longue. */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {starting && ["top_tracks", "events"].map((key) => <HomeSidebarSkeleton key={key} sectionKey={key} />)}

          {sidebarSlots.map((slot) => {
            if (slot.status !== "ready") return <HomeSidebarSkeleton key={slot.key} sectionKey={slot.key} />;
            switch (slot.key) {
              case "top_tracks":
                return topTracks && topTracks.length > 0 ? (
                  <div key={slot.key} className="rounded-xl2 border border-border bg-surface p-4">
                    <SectionHeader title={slot.title} seeAllHref="/classements" icon={<span>🔥</span>} />
                    <TrendingList songs={topTracks} source={{ type: "chart", label: slot.title }} />
                  </div>
                ) : null;
              case "events":
                return eventsData ? <EventsCard key={slot.key} upcomingCount={eventsData.upcomingCount} /> : null;
              case "radio":
                return radioData ? <RadioCard key={slot.key} /> : null;
              case "trending_artists":
                return artistsData ? <FeaturedArtists key={slot.key} artists={artistsData} /> : null;
              case "activity":
                return activityData ? <ActivityFeed key={slot.key} items={activityData} /> : null;
              default:
                return null;
            }
          })}

          <SupportArtistsCard />
        </aside>
      </div>

      {premiumData && (
        <div className="mt-10">
          <PremiumBanner plans={premiumData.plans} isSubscriber={premiumData.isSubscriber} />
        </div>
      )}

    </div>
  );
}

