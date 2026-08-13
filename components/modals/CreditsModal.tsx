"use client";

import Link from "next/link";
import { X, BadgeCheck, Clock, Disc3, Tag } from "lucide-react";
import type { PlayableSong } from "@/context/PlayerProvider";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function CreditsModal({ song, onClose }: { song: PlayableSong; onClose: () => void }) {
  const album = typeof song.album === "object" ? song.album : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl2 border border-border bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display">Crédits</h2>
          <button onClick={onClose} aria-label="Fermer" className="text-ink-muted hover:text-ink">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm font-medium mb-1">{song.title}</p>

        <ul className="space-y-2.5 mt-4">
          <li className="flex items-center gap-2 text-sm text-ink-muted">
            <span className="w-5 shrink-0" />
            {song.artist ? (
              <Link href={`/artiste/${song.artist._id}`} onClick={onClose} className="flex items-center gap-1 hover:text-accent">
                {song.artist.stageName}
                {song.artist.verified && <BadgeCheck size={13} className="text-verified" />}
              </Link>
            ) : (
              <span className="italic text-accent">Artiste supprimé</span>
            )}
            <span className="text-xs">— artiste principal</span>
          </li>

          {song.featuring?.map((credit) => (
            <li key={credit.artist._id} className="flex items-center gap-2 text-sm text-ink-muted">
              <span className="w-5 shrink-0" />
              <Link href={`/artiste/${credit.artist._id}`} onClick={onClose} className="flex items-center gap-1 hover:text-accent">
                {credit.artist.stageName}
                {credit.artist.verified && <BadgeCheck size={13} className="text-verified" />}
              </Link>
              <span className="text-xs">— featuring{!credit.confirmed && " (non confirmé)"}</span>
            </li>
          ))}

          {album && (
            <li className="flex items-center gap-2 text-sm text-ink-muted">
              <Disc3 size={15} className="shrink-0" />
              <Link href={`/album/${album._id}`} onClick={onClose} className="hover:text-accent">
                {album.title}
              </Link>
            </li>
          )}

          {song.genre && (
            <li className="flex items-center gap-2 text-sm text-ink-muted">
              <Tag size={15} className="shrink-0" />
              {song.genre}
            </li>
          )}

          <li className="flex items-center gap-2 text-sm text-ink-muted">
            <Clock size={15} className="shrink-0" />
            {formatTime(song.duration)}
          </li>
        </ul>
      </div>
    </div>
  );
}
