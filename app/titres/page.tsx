"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SongCard } from "@/components/home/SongCard";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";
import { PageSections } from "@/components/home/PageSections";
import { Reveal } from "@/components/layout/Reveal";
import { useInfiniteList } from "@/hooks/useInfiniteScroll";
import { useSiteConfig } from "@/context/SiteConfigProvider";
import type { PlayableSong } from "@/context/PlayerProvider";
import { useUnivers } from "@/context/UniversProvider";

type Tri = "hasard" | "nouveautes" | "populaires";

const TRIS: Record<Tri, { libelle: string; titre: string; sousTitre: string }> = {
  hasard: { libelle: "Au hasard", titre: "Découvrir", sousTitre: "Tous les titres publiés sur Moziik, dans un ordre mélangé." },
  nouveautes: { libelle: "Nouveautés", titre: "Nouveautés", sousTitre: "Les dernières sorties, de la plus récente à la plus ancienne." },
  populaires: { libelle: "Populaires", titre: "Les plus écoutés", sousTitre: "Les titres les plus écoutés sur Moziik." },
};

const estTri = (v: string | null): v is Tri => v !== null && v in TRIS;

/**
 * Parcourt tous les titres publiés, page par page, en préchargeant la
 * suite avant que l'utilisateur n'atteigne le bas (scroll infini, voir
 * hooks/useInfiniteScroll.ts). Destination des tuiles de genre de
 * l'accueil (`GenreTiles`) : `?genre=` présélectionne le filtre.
 */
function BrowseSongsPageContent() {
  const siteConfig = useSiteConfig();
  const searchParams = useSearchParams();
  const GENRES = ["Tous", ...siteConfig.genres];
  // Pas besoin de vérifier que le genre existe dans GENRES : un genre
  // inconnu se traduit simplement par "Aucun titre pour ce genre"
  // ci-dessous, sans état incohérent.
  const [genre, setGenre] = useState(searchParams.get("genre") || "Tous");
  // Trois ordres : mélangé pour découvrir, par date pour suivre les sorties
  // (« Voir tout » des Nouveautés de l'accueil arrive ici avec ?tri=), par
  // écoutes pour les valeurs sûres.
  const [tri, setTri] = useState<Tri>(estTri(searchParams.get("tri")) ? (searchParams.get("tri") as Tri) : "hasard");
  const { univers } = useUnivers();
  // Les titres arrivent mélangés, sans blocs par album ni par artiste. La
  // graine, tirée à l'ouverture, garde le même ordre pendant le défilement ;
  // revenir sur la page donne un nouveau mélange.
  const [graine] = useState(() => 1 + Math.floor(Math.random() * 2_000_000_000));

  const fetchPage = useCallback(
    async (page: number) => {
      const params = new URLSearchParams({ page: String(page), limit: "24" });
      if (tri === "hasard") {
        params.set("sort", "random");
        params.set("seed", String(graine));
      } else if (tri === "populaires") {
        params.set("sort", "popular");
      }
      if (genre !== "Tous") params.set("genre", genre);
      const res = await fetch(`/api/songs?${params}`);
      if (!res.ok) throw new Error("Échec du chargement.");
      const data = await res.json();
      return { items: data.songs as PlayableSong[], hasMore: data.hasMore as boolean };
    },
    [genre, graine, tri]
  );

  // La clé de la liste porte l'univers et le tri : les changer remet la
  // pagination à zéro et repart du bon catalogue, comme un changement de genre.
  const { items: songs, loading, initialLoading, hasMore, sentinelRef } = useInfiniteList(
    fetchPage,
    `${genre}:${univers}:${tri}`
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-8 md:px-10 md:py-10">
      <h1 className="mb-1 font-display text-2xl font-bold md:text-3xl">{TRIS[tri].titre}</h1>
      <p className="mb-6 text-sm text-ink-muted">{TRIS[tri].sousTitre}</p>

      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Ordre des titres">
        {(Object.keys(TRIS) as Tri[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tri === t}
            onClick={() => setTri(t)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ${
              tri === t ? "bg-ink text-base" : "bg-ink/[0.08] text-ink hover:bg-ink/[0.14]"
            }`}
          >
            {TRIS[t].libelle}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {GENRES.map((g) => (
          <button
            key={g}
            onClick={() => setGenre(g)}
            aria-pressed={genre === g}
            // Les mêmes puces que l'accueil, la bibliothèque et les classements.
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ${
              genre === g ? "bg-ink text-base" : "bg-ink/[0.08] text-ink hover:bg-ink/[0.14]"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Sections éditoriales de l'admin : placées **avant** la liste, car
          celle-ci défile à l'infini — au-dessous, personne ne les
          atteindrait jamais. Rien ne s'affiche tant qu'aucune n'est
          activée dans l'administration. */}
      <PageSections page="discover" className="mb-10" />

      {initialLoading ? (
        <SkeletonCardGrid count={12} />
      ) : songs.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-muted">Aucun titre pour ce genre.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-2 gap-y-3 cq-sm:grid-cols-3 cq-md:grid-cols-4 cq-lg:grid-cols-6">
            {songs.map((song, index) => (
              <Reveal key={song._id} delayMs={(index % 12) * 30}>
                <SongCard song={song} queue={songs} index={index} />
              </Reveal>
            ))}
          </div>

          {/* Sentinelle observée par IntersectionObserver : déclenche le
              chargement de la page suivante avant d'être réellement visible
              (rootMargin dans useInfiniteScroll), pour un enchaînement sans
              à-coup façon TikTok/Spotify. */}
          <div ref={sentinelRef} className="h-1" />

          {loading && (
            <div className="mt-6">
              <SkeletonCardGrid count={6} />
            </div>
          )}

          {!hasMore && songs.length > 0 && (
            <p className="py-8 text-center text-xs text-ink-muted">Tu as tout écouté — plus rien à charger.</p>
          )}
        </>
      )}
    </div>
  );
}

export default function BrowseSongsPage() {
  return (
    <Suspense>
      <BrowseSongsPageContent />
    </Suspense>
  );
}
