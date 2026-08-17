"use client";

import { X, Mic2 } from "lucide-react";
import { useEscapeClose } from "@/hooks/useEscapeClose";

export function LyricsSheet({
  title,
  artist,
  lyrics,
  onClose,
}: {
  title: string;
  artist?: string;
  lyrics: string;
  onClose: () => void;
}) {
  useEscapeClose(onClose);
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full flex-col rounded-t-3xl bg-surface animate-toast-in"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Mic2 size={15} className="text-accent" /> Paroles
          </span>
          <button onClick={onClose} aria-label="Fermer les paroles" className="text-ink-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">
          <p className="mb-4 text-sm text-ink-muted">
            {title}
            {artist ? ` — ${artist}` : ""}
          </p>
          <p className="whitespace-pre-line text-base text-ink leading-relaxed">{lyrics}</p>
        </div>
      </div>
    </div>
  );
}
