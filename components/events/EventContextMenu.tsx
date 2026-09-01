"use client";

import { useRouter } from "next/navigation";
import { Pencil, Share2, Trash2, Ticket, Eye } from "lucide-react";
import { ContextMenuShell, MenuItem, MenuSeparator } from "@/components/ui/ContextMenuShell";

type Position = { x: number; y: number };

export type EventContextMenuTarget = {
  _id: string;
  title: string;
  ticketUrl?: string;
};

export function EventContextMenu({
  event,
  position,
  canManage,
  onClose,
  onShare,
  onRequestDelete,
}: {
  event: EventContextMenuTarget;
  position: Position;
  canManage?: boolean;
  onClose: () => void;
  onShare: () => void;
  onRequestDelete: () => void;
}) {
  const router = useRouter();

  return (
    <ContextMenuShell anchor={position} onClose={onClose}>
      <MenuItem
        icon={Eye}
        label="Voir la fiche"
        onClick={() => { router.push(`/evenements/${event._id}`); onClose(); }}
      />
      {event.ticketUrl && (
        <MenuItem
          icon={Ticket}
          label="Ouvrir la billetterie"
          onClick={() => {
            window.open(event.ticketUrl, "_blank", "noopener,noreferrer");
            onClose();
          }}
        />
      )}
      <MenuItem icon={Share2} label="Partager" onClick={() => { onShare(); onClose(); }} />

      {canManage && (
        <>
          <MenuSeparator />
          <MenuItem
            icon={Pencil}
            label="Modifier"
            onClick={() => { router.push(`/evenements/${event._id}/modifier`); onClose(); }}
          />
          <MenuItem
            icon={Trash2}
            label="Supprimer"
            danger
            onClick={() => { onRequestDelete(); onClose(); }}
          />
        </>
      )}
    </ContextMenuShell>
  );
}
