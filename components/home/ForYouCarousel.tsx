"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";

export type HubCard = {
  _id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  coverUrl?: string;
  linkHref: string;
};

// Un dégradé par position (répété si plus de cartes) pour garder une
// identité visuelle même quand une carte n'a pas encore de pochette
// résolue (ex: aucun titre publié dans le genre "chill").
const FALLBACK_GRADIENTS = [
  "from-slate-800 via-slate-700 to-slate-900",
  "from-fuchsia-700 via-purple-700 to-indigo-900",
  "from-neutral-900 via-neutral-800 to-black",
  "from-orange-600 via-rose-500 to-pink-600",
];

export function ForYouCarousel({ title, cards }: { title: string; cards: HubCard[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollBy(direction: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  }

  if (cards.length === 0) return null;

  return (
    <section id="for_you">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg">{title}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scrollBy(-1)}
            aria-label="Précédent"
            className="grid h-8 w-8 place-items-center rounded-full border border-border text-ink-muted hover:text-ink"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => scrollBy(1)}
            aria-label="Suivant"
            className="grid h-8 w-8 place-items-center rounded-full border border-border text-ink-muted hover:text-ink"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div ref={scrollerRef} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 [scrollbar-width:none]">
        {cards.map((card, index) => (
          <Link
            key={card._id}
            href={card.linkHref}
            className="group relative h-44 w-64 shrink-0 snap-start overflow-hidden rounded-xl2"
          >
            {card.coverUrl ? (
              <>
                <SafeImage
                  src={card.coverUrl}
                  alt=""
                  width={300}
                  height={200}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
              </>
            ) : (
              <div className={`absolute inset-0 bg-gradient-to-br ${FALLBACK_GRADIENTS[index % FALLBACK_GRADIENTS.length]}`} />
            )}

            <div className="relative flex h-full flex-col justify-between p-4 text-white">
              <div>
                <p className="text-sm font-medium">{card.title}</p>
                {card.badge && <p className="font-display text-3xl">{card.badge}</p>}
              </div>
              {card.subtitle && <p className="max-w-[80%] text-xs text-white/80">{card.subtitle}</p>}
            </div>

            <span className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-white text-base shadow-lg">
              <Play size={15} className="text-black" fill="currentColor" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
