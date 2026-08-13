"use client";

import { useState } from "react";
import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";
import { BadgeCheck, Users, Share2 } from "lucide-react";
import { useLongPress } from "@/components/music/useLongPress";
import { ContextMenuShell, MenuItem } from "@/components/ui/ContextMenuShell";
import { ShareModal } from "@/components/share/ShareModal";
import { buildArtistSubject } from "@/components/share/shareSubject";

type FollowedArtist = {
  _id: string;
  stageName: string;
  verified?: boolean;
  coverUrl?: string;
  followersCount: number;
};

export function ArtistListItem({
  artist,
  onToggleFollow,
}: {
  artist: FollowedArtist;
  onToggleFollow: (artistId: string) => void;
}) {
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  function openMenuAt(x: number, y: number) {
    setMenuPosition({ x, y });
  }
  const longPress = useLongPress((x, y) => openMenuAt(x, y));

  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface">
      <Link
        href={`/artiste/${artist._id}`}
        className="flex min-w-0 flex-1 items-center gap-3"
        onContextMenu={(e) => {
          e.preventDefault();
          openMenuAt(e.clientX, e.clientY);
        }}
        onTouchStart={longPress.onTouchStart}
        onTouchEnd={longPress.onTouchEnd}
        onTouchMove={longPress.onTouchMove}
      >
        <SafeImage
          src={artist.coverUrl}
          alt={artist.stageName}
          width={44}
          height={44}
          className="shrink-0 rounded-full object-cover"
        />
        <span className="min-w-0">
          <span className="flex items-center gap-1 truncate text-sm">
            {artist.stageName}
            {artist.verified && <BadgeCheck size={12} className="shrink-0 text-verified" />}
          </span>
          <span className="flex items-center gap-1 text-xs text-ink-muted">
            <Users size={11} /> {artist.followersCount} abonné{artist.followersCount > 1 ? "s" : ""}
          </span>
        </span>
      </Link>
      <button
        onClick={() => onToggleFollow(artist._id)}
        className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"
      >
        Ne plus suivre
      </button>

      {menuPosition && (
        <ContextMenuShell anchor={menuPosition} onClose={() => setMenuPosition(null)}>
          <MenuItem
            icon={Share2}
            label="Partager"
            onClick={() => {
              setShowShareModal(true);
              setMenuPosition(null);
            }}
          />
        </ContextMenuShell>
      )}

      {showShareModal && <ShareModal subject={buildArtistSubject(artist)} onClose={() => setShowShareModal(false)} />}
    </div>
  );
}
