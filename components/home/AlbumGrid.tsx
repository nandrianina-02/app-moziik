"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Share2, Mic2 } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { useLongPress } from "@/components/music/useLongPress";
import { ContextMenuShell, MenuItem } from "@/components/ui/ContextMenuShell";
import { ShareModal } from "@/components/share/ShareModal";
import { buildAlbumSubject } from "@/components/share/shareSubject";

type AlbumCardData = {
  _id: string;
  title: string;
  coverUrl: string;
  artist: { _id?: string; stageName: string; verified?: boolean } | null;
};

export function AlbumGrid({ albums }: { albums: AlbumCardData[] }) {
  return (
    <div className="stagger grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {albums.map((album) => (
        <AlbumTile key={album._id} album={album} />
      ))}
    </div>
  );
}

function AlbumTile({ album }: { album: AlbumCardData }) {
  const router = useRouter();
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  function openMenuAt(x: number, y: number) {
    setMenuPosition({ x, y });
  }
  const longPress = useLongPress((x, y) => openMenuAt(x, y));

  return (
    <div>
      <Link
        href={`/album/${album._id}`}
        className="group"
        onContextMenu={(e) => {
          e.preventDefault();
          openMenuAt(e.clientX, e.clientY);
        }}
        onTouchStart={longPress.onTouchStart}
        onTouchEnd={longPress.onTouchEnd}
        onTouchMove={longPress.onTouchMove}
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-xl2 bg-surface">
          <SafeImage src={album.coverUrl} alt={album.title} width={200} height={200} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        </div>
        <p className="mt-2 truncate text-sm font-medium text-ink">{album.title}</p>
        <p className="flex items-center gap-1 truncate text-xs text-ink-muted">
          {album.artist?.stageName ?? "Artiste supprimé"}
          {album.artist?.verified && <BadgeCheck size={11} className="shrink-0 text-verified" />}
        </p>
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
          {album.artist?._id && (
            <MenuItem
              icon={Mic2}
              label="Aller à l'artiste"
              onClick={() => {
                router.push(`/artiste/${album.artist!._id}`);
                setMenuPosition(null);
              }}
            />
          )}
        </ContextMenuShell>
      )}

      {showShareModal && <ShareModal subject={buildAlbumSubject(album)} onClose={() => setShowShareModal(false)} />}
    </div>
  );
}
