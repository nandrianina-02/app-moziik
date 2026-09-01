"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Heart, MapPin, MoreVertical, Radio, Users } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatCompactNumber } from "@/lib/formatNumber";
import { useToast } from "@/context/ToastProvider";
import { useFuseauHoraire } from "@/context/SiteConfigProvider";
import { useLongPress } from "@/components/music/useLongPress";
import { EventContextMenu } from "@/components/events/EventContextMenu";
import { getEventTimeStatus } from "@/components/events/eventStatus";
import { jourLong, heure } from "@/components/events/eventPresentation";
import { libelleCategorie } from "@/lib/evenements";
import type { EventItem } from "@/components/events/types";

const ETIQUETTE = {
  upcoming: { label: "À venir", classe: "bg-accent/10 text-accent" },
  live: { label: "En cours", classe: "bg-verified/10 text-verified" },
  past: { label: "Passé", classe: "bg-ink-muted/10 text-ink-muted" },
};

/** Le squelette de chargement, calé sur la même forme que la ligne réelle. */
export function EventRowSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4 rounded-xl2 border border-border bg-surface p-3 sm:flex-row">
      <div className="aspect-[16/10] w-full shrink-0 rounded-xl bg-base sm:w-[200px] lg:w-[230px]" />
      <div className="flex-1 space-y-2.5 py-1">
        <div className="h-4 w-24 rounded-full bg-base" />
        <div className="h-4 w-2/3 rounded bg-base" />
        <div className="h-3 w-full rounded bg-base" />
        <div className="h-3 w-1/2 rounded bg-base" />
      </div>
    </div>
  );
}

/**
 * Un évènement en ligne, pour la liste principale.
 *
 * Format horizontal : l'affiche reste assez grande pour être lue, et la
 * date, le lieu et le nombre d'intéressés tiennent sur une seule ligne —
 * ce qu'une grille de vignettes ne permettait pas.
 */
export function EventRow({
  event,
  interesse,
  onToggleInteret,
  canManage,
  onDeleted,
}: {
  event: EventItem;
  interesse: boolean;
  onToggleInteret: (id: string) => void;
  canManage: boolean;
  onDeleted: (id: string) => void;
}) {
  const pushToast = useToast();
  const fuseau = useFuseauHoraire();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [suppression, setSuppression] = useState(false);

  const statut = getEventTimeStatus(event.date);
  const etiquette = ETIQUETTE[statut];
  const longPress = useLongPress((x, y) => setMenu({ x, y }));

  async function partager() {
    const url = `${window.location.origin}/evenements/${event._id}`;
    if (navigator.share) {
      await navigator.share({ title: event.title, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      pushToast("success", "Lien copié dans le presse-papiers.");
    }
  }

  async function supprimer() {
    setSuppression(true);
    try {
      const res = await fetch(`/api/events/${event._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      pushToast("success", "Évènement supprimé.");
      onDeleted(event._id);
    } catch {
      pushToast("error", "La suppression a échoué.");
    } finally {
      setSuppression(false);
      setConfirmation(false);
    }
  }

  return (
    <article
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
      onTouchStart={longPress.onTouchStart}
      onTouchEnd={longPress.onTouchEnd}
      onTouchMove={longPress.onTouchMove}
      className="group relative flex flex-col gap-4 rounded-xl2 border border-border bg-surface p-3 transition-colors hover:border-accent/40 sm:flex-row"
    >
      <Link
        href={`/evenements/${event._id}`}
        className="w-full shrink-0 overflow-hidden rounded-xl bg-base sm:w-[200px] lg:w-[230px]"
        aria-label={`Voir la fiche de ${event.title}`}
      >
        <SafeImage
          src={event.coverUrl}
          alt={event.title}
          width={230}
          height={144}
          className="aspect-[16/10] w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2 py-1 pr-1">
        <div className="flex flex-wrap items-center gap-2">
          {event.category && (
            <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
              {libelleCategorie(event.category)}
            </span>
          )}
          <span
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${etiquette.classe}`}
          >
            {statut === "live" && <Radio size={10} className="animate-pulse" />}
            {etiquette.label}
          </span>
        </div>

        <h3 className="truncate text-base font-semibold leading-snug">
          <Link href={`/evenements/${event._id}`} className="transition-colors hover:text-accent">
            {event.title}
          </Link>
        </h3>

        <p className="line-clamp-2 text-sm text-ink-muted">{event.description}</p>

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5">
            <CalendarDays size={12} className="shrink-0" />
            {jourLong(event.date, fuseau)} • {heure(event.date, fuseau)}
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">{[event.location, event.city].filter(Boolean).join(", ")}</span>
          </span>
          {(event.interestedCount ?? 0) > 0 && (
            <span className="flex items-center gap-1.5">
              <Users size={12} className="shrink-0" />
              {formatCompactNumber(event.interestedCount as number)}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-row items-center gap-2 sm:flex-col sm:items-end sm:justify-center sm:pr-2">
        <Link
          href={`/evenements/${event._id}`}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
        >
          Voir détails
        </Link>

        <button
          type="button"
          onClick={() => onToggleInteret(event._id)}
          aria-pressed={interesse}
          aria-label={interesse ? "Retirer de mes intérêts" : "Ça m'intéresse"}
          className={`grid h-10 w-10 place-items-center rounded-xl border transition-colors ${
            interesse
              ? "border-accent bg-accent/10 text-accent"
              : "border-border text-ink-muted hover:border-accent hover:text-accent"
          }`}
        >
          <Heart size={16} fill={interesse ? "currentColor" : "none"} />
        </button>

        {canManage && (
          <button
            type="button"
            onClick={(e) => setMenu({ x: e.clientX, y: e.clientY })}
            aria-label="Options de l'évènement"
            className="grid h-10 w-10 place-items-center rounded-xl border border-border text-ink-muted transition-colors hover:border-accent hover:text-accent"
          >
            <MoreVertical size={16} />
          </button>
        )}
      </div>

      {menu && (
        <EventContextMenu
          event={event}
          position={menu}
          canManage={canManage}
          onClose={() => setMenu(null)}
          onShare={partager}
          onRequestDelete={() => setConfirmation(true)}
        />
      )}

      {confirmation && (
        <ConfirmDialog
          title="Supprimer cet évènement ?"
          description={`"${event.title}" sera définitivement supprimé. Cette action est irréversible.`}
          confirmLabel="Supprimer"
          busy={suppression}
          onConfirm={supprimer}
          onCancel={() => setConfirmation(false)}
        />
      )}
    </article>
  );
}
