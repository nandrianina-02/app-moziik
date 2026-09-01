"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  MapPin,
  Users,
  Ticket,
  CalendarPlus,
  Heart,
  ChevronRight,
  Radio,
} from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { formatCompactNumber } from "@/lib/formatNumber";
import { useSiteConfig, useFuseauHoraire } from "@/context/SiteConfigProvider";
import { getEventTimeStatus } from "@/components/events/eventStatus";
import { jourLong, plageHoraire, lienCarte } from "@/components/events/eventPresentation";
import { libelleCategorie } from "@/lib/evenements";
import type { EventDetail } from "@/components/events/detail/types";

const ETIQUETTE_TEMPS = {
  upcoming: { label: "À venir", classe: "bg-accent/15 text-accent" },
  live: { label: "En direct", classe: "bg-verified/15 text-verified" },
  past: { label: "Terminé", classe: "bg-white/10 text-white/70" },
};

/**
 * Bandeau de tête de la fiche : l'affiche, la galerie, et tout ce qu'on
 * veut savoir avant de lire quoi que ce soit — quand, où, combien de
 * personnes y vont, comment prendre sa place.
 *
 * Le fond reprend l'affiche, floutée et assombrie, pour que le bandeau
 * garde la même profondeur dans les deux thèmes sans avoir à figer une
 * couleur qui jurerait avec l'un des deux.
 */
export function EventHero({
  event,
  onToggleInteret,
  interetEnCours,
}: {
  event: EventDetail;
  onToggleInteret: () => void;
  interetEnCours: boolean;
}) {
  const { currency } = useSiteConfig();
  const fuseau = useFuseauHoraire();
  const [imagePrincipale, setImagePrincipale] = useState(event.coverUrl);
  const [galerieEtendue, setGalerieEtendue] = useState(false);

  const statut = getEventTimeStatus(event.date);
  const etiquette = ETIQUETTE_TEMPS[statut];

  // L'affiche ouvre toujours la galerie : c'est elle qu'on regarde en
  // premier, et la retirer de la bande de miniatures empêcherait d'y revenir.
  const toutesLesImages = [event.coverUrl, ...(event.gallery ?? [])].filter(
    (url): url is string => Boolean(url)
  );
  const MINIATURES_VISIBLES = 5;
  const miniatures = galerieEtendue ? toutesLesImages : toutesLesImages.slice(0, MINIATURES_VISIBLES);
  const restantes = toutesLesImages.length - MINIATURES_VISIBLES;

  const carte = lienCarte(event);

  return (
    <section className="relative overflow-hidden rounded-xl2 bg-[#0b1020]">
      {event.coverUrl && (
        <div aria-hidden className="absolute inset-0">
          <SafeImage
            src={event.coverUrl}
            alt=""
            width={1600}
            height={900}
            className="h-full w-full scale-110 object-cover opacity-40 blur-2xl"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#0b1020]/95 via-[#0b1020]/85 to-[#0b1020]/95" />
        </div>
      )}

      <div className="relative px-5 py-6 text-white md:px-8 md:py-8">
        <nav aria-label="Fil d'Ariane" className="mb-5 flex flex-wrap items-center gap-1 text-xs text-white/60">
          <Link href="/evenements" className="transition-colors hover:text-white">
            Évènements
          </Link>
          <ChevronRight size={12} className="shrink-0" />
          <span>{libelleCategorie(event.category)}</span>
          <ChevronRight size={12} className="shrink-0" />
          <span className="truncate text-white/90">{event.title}</span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          <div>
            <div className="overflow-hidden rounded-xl bg-white/5">
              <SafeImage
                src={imagePrincipale}
                alt={event.title}
                width={800}
                height={500}
                priority
                className="aspect-[16/10] w-full object-cover"
              />
            </div>

            {toutesLesImages.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {miniatures.map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setImagePrincipale(url)}
                    aria-label="Afficher cette photo"
                    aria-current={url === imagePrincipale}
                    className={`h-14 w-20 overflow-hidden rounded-lg border-2 transition-colors ${
                      url === imagePrincipale ? "border-accent" : "border-transparent hover:border-white/40"
                    }`}
                  >
                    <SafeImage src={url} alt="" width={80} height={56} className="h-full w-full object-cover" />
                  </button>
                ))}

                {!galerieEtendue && restantes > 0 && (
                  <button
                    type="button"
                    onClick={() => setGalerieEtendue(true)}
                    className="h-14 w-20 rounded-lg border border-white/20 bg-white/5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10"
                  >
                    +{restantes}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-base">
                {libelleCategorie(event.category)}
              </span>
              <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${etiquette.classe}`}>
                {statut === "live" && <Radio size={11} className="animate-pulse" />}
                {etiquette.label}
              </span>
            </div>

            <h1 className="font-display text-2xl leading-tight md:text-3xl lg:text-4xl">{event.title}</h1>

            {/* Deux lignes seulement : le texte complet est repris juste en
                dessous, dans « À propos ». Ici il sert d'accroche. */}
            <p className="mt-3 line-clamp-2 max-w-prose text-sm leading-relaxed text-white/70">
              {event.description}
            </p>

            <dl className="mt-5 space-y-2.5 text-sm text-white/80">
              <div className="flex items-start gap-2.5">
                <dt className="sr-only">Date</dt>
                <CalendarDays size={16} className="mt-0.5 shrink-0 text-white/50" />
                <dd>
                  {jourLong(event.date, fuseau)}
                  <span className="text-white/50"> • </span>
                  {plageHoraire(event.date, event.endDate, fuseau)}
                </dd>
              </div>

              <div className="flex items-start gap-2.5">
                <dt className="sr-only">Lieu</dt>
                <MapPin size={16} className="mt-0.5 shrink-0 text-white/50" />
                <dd className="flex flex-wrap items-center gap-x-2">
                  <span>{[event.address, event.location].filter(Boolean).join(", ")}</span>
                  <a
                    href={carte}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline-offset-2 hover:underline"
                  >
                    Voir sur la carte
                  </a>
                </dd>
              </div>

              {event.interestedCount > 0 && (
                <div className="flex items-start gap-2.5">
                  <dt className="sr-only">Participants</dt>
                  <Users size={16} className="mt-0.5 shrink-0 text-white/50" />
                  <dd>
                    {formatCompactNumber(event.interestedCount)}{" "}
                    {event.interestedCount > 1 ? "membres intéressés" : "membre intéressé"}
                  </dd>
                </div>
              )}
            </dl>

            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              {event.ticketUrl ? (
                <a
                  href={event.ticketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
                >
                  <Ticket size={16} /> Obtenir des billets
                </a>
              ) : (
                typeof event.price === "number" && (
                  <span className="rounded-xl bg-white/10 px-5 py-3 text-sm font-medium">
                    {event.price === 0
                      ? "Entrée libre"
                      : `À partir de ${event.price} ${currency ?? "EUR"}`}
                  </span>
                )
              )}

              <a
                href={`/api/events/${event._id}/calendrier`}
                className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                <CalendarPlus size={16} /> Ajouter au calendrier
              </a>

              <button
                type="button"
                onClick={onToggleInteret}
                disabled={interetEnCours}
                aria-pressed={event.viewerInterested}
                aria-label={event.viewerInterested ? "Retirer de mes intérêts" : "Ça m'intéresse"}
                className={`grid h-12 w-12 place-items-center rounded-xl border transition-colors disabled:opacity-60 ${
                  event.viewerInterested
                    ? "border-accent bg-accent/20 text-accent"
                    : "border-white/20 bg-white/5 text-white hover:bg-white/10"
                }`}
              >
                <Heart size={17} fill={event.viewerInterested ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
