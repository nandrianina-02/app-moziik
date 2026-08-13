"use client";

import { useState } from "react";
import Link from "next/link";
import { ListMusic, Share2 } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { useLongPress } from "@/components/music/useLongPress";
import { ContextMenuShell, MenuItem } from "@/components/ui/ContextMenuShell";
import { ShareModal } from "@/components/share/ShareModal";
import { buildPlaylistSubject } from "@/components/share/shareSubject";

type PlaylistCardData = {
  _id: string;
  title: string;
  coverUrl?: string;
  songsCount: number;
  isPublic?: boolean;
  contributorAvatars?: { name: string; coverUrl?: string }[];
};

export function PlaylistGrid({ playlists }: { playlists: PlaylistCardData[] }) {
  return (
    <div className="stagger grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {playlists.map((playlist) => (
        <PlaylistTile key={playlist._id} playlist={playlist} />
      ))}
    </div>
  );
}

function PlaylistTile({ playlist }: { playlist: PlaylistCardData }) {
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  function openMenuAt(x: number, y: number) {
    setMenuPosition({ x, y });
  }
  const longPress = useLongPress((x, y) => openMenuAt(x, y));

  return (
    <div>
      <Link
        href={`/playlist/${playlist._id}`}
        className="group relative block aspect-[4/5] w-full overflow-hidden rounded-xl2 bg-surface"
        onContextMenu={(e) => {
          e.preventDefault();
          openMenuAt(e.clientX, e.clientY);
        }}
        onTouchStart={longPress.onTouchStart}
        onTouchEnd={longPress.onTouchEnd}
        onTouchMove={longPress.onTouchMove}
      >
        {playlist.coverUrl ? (
          <SafeImage
            src={playlist.coverUrl}
            alt={playlist.title}
            width={220}
            height={280}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-ink-muted">
            <ListMusic size={28} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 p-3 text-white">
          <p className="truncate text-sm font-semibold">{playlist.title}</p>
          <p className="truncate text-xs text-white/75">{playlist.songsCount} titres</p>

          {playlist.contributorAvatars && playlist.contributorAvatars.length > 0 && (
            <div className="mt-2 flex -space-x-2">
              {playlist.contributorAvatars.map((contributor, i) => (
                <span
                  key={i}
                  className="h-6 w-6 overflow-hidden rounded-full ring-2 ring-black/40"
                  title={contributor.name}
                >
                  <SafeImage
                    src={contributor.coverUrl}
                    alt={contributor.name}
                    width={24}
                    height={24}
                    className="h-full w-full object-cover"
                  />
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>

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

      {showShareModal && (
        <ShareModal subject={buildPlaylistSubject({ ...playlist, isPublic: playlist.isPublic ?? true })} onClose={() => setShowShareModal(false)} />
      )}
    </div>
  );
}
