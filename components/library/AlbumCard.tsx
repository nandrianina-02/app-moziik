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
import { BoutonLectureCarte } from "@/components/music/BoutonLectureCarte";
import { titresDeLAlbum } from "@/components/music/titresCollections";
import { usePlayer } from "@/context/PlayerProvider";

type LibraryAlbum = {
  _id: string;
  title: string;
  coverUrl: string;
  artist: { _id: string; stageName: string; verified?: boolean } | null;
};

export function AlbumCard({ album, onUnsave }: { album: LibraryAlbum; onUnsave?: (id: string) => void }) {
  const router = useRouter();
  const { playSource } = usePlayer();
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  function openMenuAt(x: number, y: number) {
    setMenuPosition({ x, y });
  }
  const longPress = useLongPress((x, y) => openMenuAt(x, y));

  return (
    // Même carte que l'accueil : elle s'éclaire au survol, la lecture se lance depuis la pochette.
    <div className="group relative rounded-lg p-2 transition-colors duration-200 hover:bg-ink/[0.06]">
      {/* Sans préchargement : ce lien se répète à chaque élément de la liste, et Next tirerait sinon une charge de route par élément visible. */}
      <Link
        href={`/album/${album._id}`}
        prefetch={false}
        className="pressable block"
        onContextMenu={(e) => {
          e.preventDefault();
          openMenuAt(e.clientX, e.clientY);
        }}
        onTouchStart={longPress.onTouchStart}
        onTouchEnd={longPress.onTouchEnd}
        onTouchMove={longPress.onTouchMove}
      >
        <div className="relative mb-2.5 aspect-square w-full overflow-hidden rounded-md bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
          <SafeImage src={album.coverUrl} alt={album.title} width={160} height={160} className="h-full w-full object-cover" />
          <BoutonLectureCarte
            titres={() => titresDeLAlbum(album._id, album.artist)}
            source={{ type: "album", label: album.title, id: album._id }}
            enCours={playSource?.type === "album" && playSource.id === album._id}
            libelle={album.title}
          />
        </div>
        <p className="truncate text-sm font-semibold">{album.title}</p>
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
          className="absolute right-4 top-4 z-10 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white au-survol"
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
