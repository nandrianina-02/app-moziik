"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { useFuseauHoraire } from "@/context/SiteConfigProvider";
import { heure, jourLong } from "@/components/events/eventPresentation";
import type { EventItem } from "@/components/events/types";

/**
 * Bande d'affiches défilante — « Évènements populaires ».
 *
 * Défilement horizontal natif : il fonctionne au doigt sur mobile, à la
 * molette sur un pavé tactile, et les flèches ne servent qu'à la souris.
 */
export function EventPosterRow({
  events,
  interestedIds,
  onToggleInteret,
}: {
  events: EventItem[];
  interestedIds: Set<string>;
  onToggleInteret: (id: string) => void;
}) {
  const piste = useRef<HTMLDivElement>(null);
  const fuseau = useFuseauHoraire();

  function faireDefiler(sens: 1 | -1) {
    // 80 % de la largeur visible : on avance d'un écran presque entier
    // tout en gardant une carte en commun, pour ne pas perdre le fil.
    const largeur = piste.current?.clientWidth ?? 0;
    piste.current?.scrollBy({ left: sens * largeur * 0.8, behavior: "smooth" });
  }

  if (events.length === 0) return null;

  return (
    <section className="rounded-xl2 border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Évènements populaires</h2>

        <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
          <button
            type="button"
            onClick={() => faireDefiler(-1)}
            aria-label="Faire défiler vers la gauche"
            className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink-muted transition-colors hover:border-accent hover:text-accent"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={() => faireDefiler(1)}
            aria-label="Faire défiler vers la droite"
            className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink-muted transition-colors hover:border-accent hover:text-accent"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div
        ref={piste}
        className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {events.map((event) => {
          const interesse = interestedIds.has(event._id);
          return (
            <article
              key={event._id}
              className="group w-[200px] shrink-0 snap-start sm:w-[220px]"
            >
              <div className="relative overflow-hidden rounded-xl bg-base">
                <Link href={`/evenements/${event._id}`} aria-label={`Voir la fiche de ${event.title}`}>
                  <SafeImage
                    src={event.coverUrl}
                    alt={event.title}
                    width={220}
                    height={140}
                    className="aspect-[16/10] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </Link>

                <button
                  type="button"
                  onClick={() => onToggleInteret(event._id)}
                  aria-pressed={interesse}
                  aria-label={interesse ? "Retirer de mes intérêts" : "Ça m'intéresse"}
                  className={`absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full backdrop-blur-md transition-colors ${
                    interesse ? "bg-accent text-base" : "bg-black/40 text-white hover:bg-black/60"
                  }`}
                >
                  <Heart size={14} fill={interesse ? "currentColor" : "none"} />
                </button>
              </div>

              <h3 className="mt-2.5 truncate text-sm font-medium">
                <Link href={`/evenements/${event._id}`} className="transition-colors hover:text-accent">
                  {event.title}
                </Link>
              </h3>
              <p className="mt-0.5 truncate text-xs text-ink-muted">
                {jourLong(event.date, fuseau)} • {heure(event.date, fuseau)}
              </p>
              <p className="truncate text-xs text-ink-muted">{event.city || event.location}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
