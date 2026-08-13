"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, CalendarDays, Ticket, BadgeCheck, Pencil, Trash2, Share2, MoreVertical, Radio } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/context/ToastProvider";
import { EventContextMenu } from "@/components/events/EventContextMenu";
import { useLongPress } from "@/components/music/useLongPress";
import { getEventTimeStatus, formatRelativeCountdown } from "@/components/events/eventStatus";

export type EventItem = {
  _id: string;
  title: string;
  description: string;
  coverUrl?: string;
  location: string;
  date: string;
  ticketUrl?: string;
  price?: number;
  createdBy: string;
  artist?: { stageName: string; verified?: boolean };
};

const statusBadge = {
  upcoming: { label: "À venir", className: "bg-accent/10 text-accent" },
  live: { label: "En direct", className: "bg-verified/10 text-verified" },
  past: { label: "Terminé", className: "bg-ink-muted/10 text-ink-muted" },
};

export function EventCard({
  event,
  canManage,
  onDeleted,
}: {
  event: EventItem;
  canManage: boolean;
  onDeleted: (id: string) => void;
}) {
  const pushToast = useToast();
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const timeStatus = getEventTimeStatus(event.date);
  const badge = statusBadge[timeStatus];

  const formattedDate = new Date(event.date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  function openMenuAt(x: number, y: number) {
    setMenuPosition({ x, y });
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    openMenuAt(e.clientX, e.clientY);
  }

  const longPress = useLongPress((x, y) => openMenuAt(x, y));

  async function handleShare() {
    const url = `${window.location.origin}/evenements#${event._id}`;
    if (navigator.share) {
      await navigator.share({ title: event.title, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      pushToast("success", "Lien copié dans le presse-papiers.");
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/events/${event._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      pushToast("success", "Évènement supprimé.");
      onDeleted(event._id);
    } catch {
      pushToast("error", "La suppression a échoué.");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div
      id={event._id}
      onContextMenu={handleContextMenu}
      onTouchStart={longPress.onTouchStart}
      onTouchEnd={longPress.onTouchEnd}
      onTouchMove={longPress.onTouchMove}
      className="group relative flex flex-col overflow-hidden rounded-xl2 border border-border bg-surface transition-all hover:border-accent/40 hover:shadow-lg hover:shadow-black/5"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-base">
        <SafeImage
          src={event.coverUrl}
          alt={event.title}
          width={400}
          height={250}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <span
          className={`absolute left-3 top-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur-md ${badge.className}`}
        >
          {timeStatus === "live" && <Radio size={10} className="animate-pulse" />}
          {badge.label}
        </span>

        {canManage && (
          <button
            onClick={(e) => openMenuAt(e.clientX, e.clientY)}
            aria-label="Options de l'évènement"
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100 focus:opacity-100"
          >
            <MoreVertical size={15} />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="truncate text-sm font-semibold leading-snug">{event.title}</h3>

        {event.artist && (
          <p className="flex items-center gap-1 text-xs text-ink-muted">
            {event.artist.stageName}
            {event.artist.verified && <BadgeCheck size={11} className="text-verified" />}
          </p>
        )}

        <p className="line-clamp-2 text-xs text-ink-muted">{event.description}</p>

        <div className="mt-1 flex flex-col gap-1.5 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5">
            <CalendarDays size={12} className="shrink-0" /> {formattedDate}
          </span>
          <span className="flex items-center gap-1.5 truncate">
            <MapPin size={12} className="shrink-0" /> {event.location}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-ink-muted">
            {timeStatus !== "past" ? formatRelativeCountdown(event.date) : "Terminé"}
          </span>

          {event.ticketUrl ? (
            <a
              href={event.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent hover:bg-accent/20"
            >
              <Ticket size={11} /> {event.price ? `${event.price} $` : "Billetterie"}
            </a>
          ) : (
            <button
              onClick={handleShare}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-ink-muted hover:bg-base hover:text-ink"
            >
              <Share2 size={11} /> Partager
            </button>
          )}
        </div>

        {canManage && (
          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
            <Link
              href={`/evenements/${event._id}/modifier`}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-base hover:text-ink"
            >
              <Pencil size={13} /> Modifier
            </Link>
            <button
              onClick={handleShare}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-base hover:text-ink"
            >
              <Share2 size={13} /> Partager
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-accent/10 hover:text-accent"
            >
              <Trash2 size={13} /> Supprimer
            </button>
          </div>
        )}
      </div>

      {menuPosition && (
        <EventContextMenu
          event={event}
          position={menuPosition}
          canManage={canManage}
          onClose={() => setMenuPosition(null)}
          onShare={handleShare}
          onRequestDelete={() => setConfirmDelete(true)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Supprimer cet évènement ?"
          description={`"${event.title}" sera définitivement supprimé. Cette action est irréversible.`}
          confirmLabel="Supprimer"
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
