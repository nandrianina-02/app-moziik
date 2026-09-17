"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Reveal } from "@/components/layout/Reveal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/context/ToastProvider";
import type { PlayableSong } from "@/context/PlayerProvider";
import { HeroCarousel, type HeroSlide } from "@/components/home/HeroCarousel";
import { AccueilEntete } from "@/components/home/AccueilEntete";
import { RaccourcisAccueil } from "@/components/home/RaccourcisAccueil";
import { CarteBandeSon } from "@/components/home/CarteBandeSon";
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
  const pushToast = useToast();

  // L'accueil se remplit section par section à mesure que le serveur les
  // calcule (voir components/home/useHomepageStream.ts) : la page est
  // dessinée en entier presque tout de suite, chaque bloc remplaçant
  // ensuite son squelette. Auparavant, un seul appel bloquant maintenait
  // l'écran vide jusqu'à ce que la dernière section soit prête.
  const { slots, hero, heroPending, starting, failed, reprise } = useHomepageStream();

  useEffect(() => {
    // `failed` n'est vrai que si l'écran est resté vide : une page reprise
    // de l'instantané n'est pas une panne, et le bandeau ci-dessous suffit
    // à dire que les données ne sont pas encore fraîches.
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
      <AccueilEntete peutPublier={canPublish} />

      {/* La page vient de l'instantané gardé sur l'appareil : elle est
          lisible tout de suite, mais elle date de la dernière visite. Le
          dire est le prix de l'affichage immédiat — sans cette ligne, on
          présenterait des données d'hier comme fraîches. */}
      {reprise && (
        <p className="mb-4 flex items-center gap-2 text-xs text-ink-muted" role="status">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          Affichage de votre dernière visite — mise à jour en cours…
        </p>
      )}

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

          {/* Les deux blocs qui suivent ne dépendent d'aucune donnée du
              flux : ils sont là dès le premier rendu, et ne laissent donc
              jamais de squelette derrière eux. */}
          <RaccourcisAccueil />
          <CarteBandeSon />

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
            colonne principale, souvent bien plus longue.

            Sous `lg`, cette colonne passe SOUS le contenu : six cartes
            empilées bout à bout, soit plusieurs écrans de défilement après
            la musique. Deux colonnes sur téléphone les ramènent à trois
            rangées. Les cartes qui portent une liste — artistes, activité —
            reprennent la pleine largeur (`sm:col-span-2` posé chez elles). */}
        <aside className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:block lg:space-y-4 lg:sticky lg:top-6 lg:self-start">
          {starting && ["top_tracks", "events"].map((key) => <HomeSidebarSkeleton key={key} sectionKey={key} />)}

          {sidebarSlots.map((slot) => {
            if (slot.status !== "ready") return <HomeSidebarSkeleton key={slot.key} sectionKey={slot.key} />;
            switch (slot.key) {
              case "top_tracks":
                return topTracks && topTracks.length > 0 ? (
                  <div key={slot.key} className="col-span-2 rounded-xl2 border border-border bg-surface p-4">
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

