"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SafeImage } from "@/components/ui/SafeImage";
import { BadgeCheck, Bookmark, Share2, Mic2 } from "lucide-react";
import { useLongPress } from "@/components/music/useLongPress";
import { ContextMenuShell, MenuItem } from "@/components/ui/ContextMenuShell";
import { ShareModal } from "@/components/share/ShareModal";
import { buildAlbumSubject } from "@/components/share/shareSubject";

type LibraryAlbum = {
  _id: string;
  title: string;
  coverUrl: string;
  artist: { _id: string; stageName: string; verified?: boolean } | null;
};

export function AlbumCard({ album, onUnsave }: { album: LibraryAlbum; onUnsave?: (id: string) => void }) {
  const router = useRouter();
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  function openMenuAt(x: number, y: number) {
    setMenuPosition({ x, y });
  }
  const longPress = useLongPress((x, y) => openMenuAt(x, y));

  return (
    <div className="group relative">
      <Link
        href={`/album/${album._id}`}
        onContextMenu={(e) => {
          e.preventDefault();
          openMenuAt(e.clientX, e.clientY);
        }}
        onTouchStart={longPress.onTouchStart}
        onTouchEnd={longPress.onTouchEnd}
        onTouchMove={longPress.onTouchMove}
      >
        <SafeImage
          src={album.coverUrl}
          alt={album.title}
          width={160}
          height={160}
          className="mb-2 aspect-square w-full rounded-xl2 object-cover"
        />
        <p className="truncate text-sm font-medium">{album.title}</p>
        <p className="flex items-center gap-1 truncate text-xs text-ink-muted">
          {album.artist?.stageName ?? "Artiste supprimé"}
          {album.artist?.verified && <BadgeCheck size={11} className="shrink-0 text-verified" />}
        </p>
      </Link>
      {onUnsave && (
        <button
          onClick={() => onUnsave(album._id)}
          aria-label="Retirer de la bibliothèque"
          title="Retirer de la bibliothèque"
          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white au-survol"
        >
          <Bookmark size={13} fill="currentColor" />
        </button>
      )}

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
          {album.artist && (
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
