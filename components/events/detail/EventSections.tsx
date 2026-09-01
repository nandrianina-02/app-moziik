"use client";

import Link from "next/link";
import { BadgeCheck, CheckCircle2, Info, MapPin, Navigation } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { adressePostale, lienCarte, urlCarteIntegree } from "@/components/events/eventPresentation";
import type { ArtisteAffiche, EventDetail, MomentProgramme } from "@/components/events/detail/types";

/**
 * Les blocs de la colonne principale.
 *
 * Chacun s'efface complètement quand l'organisateur n'a rien renseigné :
 * une fiche minimale reste une fiche propre, pas une succession de
 * rubriques vides. C'est aussi ce que lit `sectionsDisponibles` pour
 * n'afficher que les onglets qui mènent quelque part.
 */

export function BlocSection({
  id,
  titre,
  action,
  children,
}: {
  id: string;
  titre: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    // scroll-mt-28 : l'en-tête de l'application plus la barre d'onglets,
    // sans quoi un onglet amènerait le titre de la rubrique juste derrière
    // elles.
    <section id={id} className="scroll-mt-28 border-b border-border pb-8 last:border-b-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{titre}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SectionAPropos({ event }: { event: EventDetail }) {
  const highlights = event.highlights ?? [];
  return (
    <BlocSection id="a-propos" titre="À propos de l'évènement">
      <p className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">{event.description}</p>

      {highlights.length > 0 && (
        <ul className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {highlights.map((point) => (
            <li
              key={point}
              className="rounded-xl border border-border bg-surface px-3 py-3 text-center text-xs font-medium"
            >
              {point}
            </li>
          ))}
        </ul>
      )}

      {(event.tags ?? []).length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {event.tags?.map((tag) => (
            <li key={tag} className="rounded-full bg-base px-2.5 py-1 text-[11px] text-ink-muted">
              #{tag}
            </li>
          ))}
        </ul>
      )}

      {(event.inclusions ?? []).length > 0 && (
        <ul className="mt-6 space-y-2.5">
          {event.inclusions?.map((ligne) => (
            <li key={ligne} className="flex items-start gap-2.5 text-sm">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent" />
              <span className="text-ink-muted">{ligne}</span>
            </li>
          ))}
        </ul>
      )}
    </BlocSection>
  );
}

function CarteArtiste({ artiste }: { artiste: ArtisteAffiche }) {
  return (
    <Link
      href={`/artiste/${artiste._id}`}
      className="group flex w-[104px] shrink-0 flex-col items-center gap-2 text-center"
    >
      <div className="h-[104px] w-[104px] overflow-hidden rounded-xl bg-base">
        <SafeImage
          src={artiste.coverUrl}
          alt={artiste.stageName}
          width={104}
          height={104}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <span className="flex items-center gap-1 text-xs font-medium">
        <span className="truncate">{artiste.stageName}</span>
        {artiste.verified && <BadgeCheck size={11} className="shrink-0 text-verified" />}
      </span>
    </Link>
  );
}

export function SectionAffiche({ artistes }: { artistes: ArtisteAffiche[] }) {
  return (
    <BlocSection
      id="artistes"
      titre="Artistes à l'affiche"
      action={<span className="text-xs text-ink-muted">{artistes.length}</span>}
    >
      {/* Défilement horizontal plutôt qu'une grille : le nombre d'artistes
          varie de un à plusieurs dizaines, et une grille laisserait des
          trous béants dans le premier cas. */}
      <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
        {artistes.map((artiste) => (
          <CarteArtiste key={artiste._id} artiste={artiste} />
        ))}
      </div>
    </BlocSection>
  );
}

export function SectionProgramme({ moments }: { moments: MomentProgramme[] }) {
  return (
    <BlocSection id="programme" titre="Programme">
      <ol className="space-y-0">
        {moments.map((moment, index) => (
          <li key={`${moment.time}-${moment.title}`} className="flex gap-4">
            <div className="flex w-16 shrink-0 justify-end pt-0.5">
              <span className="text-xs font-medium tabular-nums text-accent">{moment.time}</span>
            </div>

            {/* Le trait relie les moments entre eux et s'arrête au dernier. */}
            <div className="relative flex flex-col items-center">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
              {index < moments.length - 1 && <span className="w-px flex-1 bg-border" />}
            </div>

            <div className="flex-1 pb-6">
              <p className="text-sm font-medium">{moment.title}</p>
              {moment.detail && <p className="mt-1 text-xs text-ink-muted">{moment.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
    </BlocSection>
  );
}

export function SectionInfosPratiques({ infos, minAge }: { infos: string[]; minAge?: number }) {
  return (
    <BlocSection id="infos-pratiques" titre="Infos pratiques">
      <ul className="space-y-2.5">
        {typeof minAge === "number" && minAge > 0 && (
          <li className="flex items-start gap-2.5 text-sm">
            <Info size={16} className="mt-0.5 shrink-0 text-ink-muted" />
            <span className="text-ink-muted">Réservé aux {minAge} ans et plus.</span>
          </li>
        )}
        {infos.map((info) => (
          <li key={info} className="flex items-start gap-2.5 text-sm">
            <Info size={16} className="mt-0.5 shrink-0 text-ink-muted" />
            <span className="text-ink-muted">{info}</span>
          </li>
        ))}
      </ul>
    </BlocSection>
  );
}

export function SectionLieu({ event }: { event: EventDetail }) {
  const carte = lienCarte(event);
  const pointConnu = typeof event.latitude === "number" && typeof event.longitude === "number";
  // Le nom de la salle est déjà le titre du bloc : le répéter dans
  // l'adresse en dessous n'apprendrait rien.
  const postale = adressePostale({ ...event, location: undefined });

  return (
    <BlocSection id="lieu" titre="Lieu">
      <div className="overflow-hidden rounded-xl2 border border-border bg-surface">
        <div className="flex flex-wrap items-start justify-between gap-3 p-4">
          <div className="flex min-w-0 items-start gap-2.5">
            <MapPin size={16} className="mt-0.5 shrink-0 text-accent" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{event.location}</p>
              {postale && <p className="mt-0.5 text-xs text-ink-muted">{postale}</p>}
            </div>
          </div>

          <a
            href={carte}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
          >
            <Navigation size={12} /> Itinéraire
          </a>
        </div>

        {/* La carte n'apparaît que si le point est vraiment connu : à
            défaut de coordonnées, mieux vaut la fiche d'adresse seule
            qu'un fond de carte pointant à côté. */}
        {pointConnu && (
          <iframe
            title={`Carte — ${event.location}`}
            src={urlCarteIntegree(event.latitude as number, event.longitude as number)}
            loading="lazy"
            className="h-64 w-full border-0 border-t border-border"
          />
        )}
      </div>
    </BlocSection>
  );
}

/** Les onglets à proposer, dans l'ordre de la page, pour cet évènement-là. */
export function sectionsDisponibles(event: EventDetail): { id: string; label: string }[] {
  const sections = [{ id: "a-propos", label: "À propos" }];
  if ((event.program ?? []).length > 0) sections.push({ id: "programme", label: "Programme" });
  if (afficheDe(event).length > 0) sections.push({ id: "artistes", label: "Artistes" });
  if ((event.practicalInfo ?? []).length > 0 || typeof event.minAge === "number") {
    sections.push({ id: "infos-pratiques", label: "Infos pratiques" });
  }
  sections.push({ id: "lieu", label: "Lieu" });
  return sections;
}

/**
 * Les artistes à montrer : celui qui porte l'évènement d'abord, puis
 * l'affiche, sans doublon — un artiste peut légitimement figurer dans les
 * deux champs sans devoir apparaître deux fois.
 */
export function afficheDe(event: EventDetail): ArtisteAffiche[] {
  const vus = new Set<string>();
  const tous = [...(event.artist ? [event.artist] : []), ...(event.lineup ?? [])];
  return tous.filter((artiste) => {
    if (!artiste?._id || vus.has(artiste._id)) return false;
    vus.add(artiste._id);
    return true;
  });
}
