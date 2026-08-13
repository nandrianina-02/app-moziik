"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Share2, ExternalLink } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { useLongPress } from "@/components/music/useLongPress";
import { ContextMenuShell, MenuItem } from "@/components/ui/ContextMenuShell";
import { ShareModal } from "@/components/share/ShareModal";
import type { ShareSubject, ShareSubjectType } from "@/components/share/shareSubject";

type CustomItem = {
  _id: string;
  contentType: "song" | "album" | "artist" | "playlist" | "event" | "custom";
  title: string;
  coverUrl?: string;
  href: string;
};

// Cette collection ne porte que des données minimales (pas d'artiste, pas
// de statistiques) : contrairement aux menus dédiés (SongContextMenu,
// AlbumGrid...), on ne peut proposer qu'un partage générique + un lien
// direct, faute d'information suffisante pour un menu plus riche.
const shareableTypes: ShareSubjectType[] = ["song", "album", "playlist", "artist"];

export function CustomCollection({ items }: { items: CustomItem[] }) {
  return (
    <div className="stagger grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {items.map((item) => (
        <CustomCollectionTile key={item._id} item={item} />
      ))}
    </div>
  );
}

function CustomCollectionTile({ item }: { item: CustomItem }) {
  const router = useRouter();
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  function openMenuAt(x: number, y: number) {
    setMenuPosition({ x, y });
  }
  const longPress = useLongPress((x, y) => openMenuAt(x, y));

  const shareSubject: ShareSubject | null = shareableTypes.includes(item.contentType as ShareSubjectType)
    ? {
        type: item.contentType as ShareSubjectType,
        id: item._id,
        title: item.title,
        coverUrl: item.coverUrl,
        path: item.href,
        stats: [],
      }
    : null;

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        openMenuAt(e.clientX, e.clientY);
      }}
      onTouchStart={longPress.onTouchStart}
      onTouchEnd={longPress.onTouchEnd}
      onTouchMove={longPress.onTouchMove}
    >
      <Link href={item.href} className="group">
        <div className="relative aspect-square w-full overflow-hidden rounded-xl2 bg-surface">
          <SafeImage
            src={item.coverUrl}
            alt={item.title}
            width={200}
            height={200}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        </div>
        <p className="mt-2 truncate text-sm font-medium text-ink">{item.title}</p>
      </Link>

      {menuPosition && (
        <ContextMenuShell anchor={menuPosition} onClose={() => setMenuPosition(null)}>
          {shareSubject && (
            <MenuItem
              icon={Share2}
              label="Partager"
              onClick={() => {
                setShowShareModal(true);
                setMenuPosition(null);
              }}
            />
          )}
          <MenuItem
            icon={ExternalLink}
            label="Ouvrir"
            onClick={() => {
              router.push(item.href);
              setMenuPosition(null);
            }}
          />
        </ContextMenuShell>
      )}

      {showShareModal && shareSubject && <ShareModal subject={shareSubject} onClose={() => setShowShareModal(false)} />}
    </div>
  );
}
