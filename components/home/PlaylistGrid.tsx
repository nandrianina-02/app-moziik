"use client";

import { useState } from "react";
import Link from "next/link";
import { ListMusic, Share2 } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { useLongPress } from "@/components/music/useLongPress";
import { Download, Loader2 } from "lucide-react";
import { useTelechargementLot } from "@/hooks/useTelechargementHorsLigne";
import { downloadPlaylistForOffline } from "@/lib/offlineCache";
import { ContextMenuShell, MenuItem } from "@/components/ui/ContextMenuShell";
import { ShareModal } from "@/components/share/ShareModal";
import { buildPlaylistSubject } from "@/components/share/shareSubject";
import { BoutonLectureCarte } from "@/components/music/BoutonLectureCarte";
import { usePlayer } from "@/context/PlayerProvider";
import { titresDeLaPlaylist } from "@/components/music/titresCollections";

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
    <div className="stagger grid grid-cols-2 gap-x-2 gap-y-3 cq-sm:grid-cols-3 cq-md:grid-cols-4 cq-lg:grid-cols-6">
      {playlists.map((playlist) => (
        <PlaylistTile key={playlist._id} playlist={playlist} />
      ))}
    </div>
  );
}

function PlaylistTile({ playlist }: { playlist: PlaylistCardData }) {
  const { playSource } = usePlayer();
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  function openMenuAt(x: number, y: number) {
    setMenuPosition({ x, y });
  }
  const longPress = useLongPress((x, y) => openMenuAt(x, y));
  const lot = useTelechargementLot();

  return (
    <div>
      {/* Sans préchargement : ce lien se répète à chaque élément de la liste, et Next tirerait sinon une charge de route par élément visible. */}
      <Link
        href={`/playlist/${playlist._id}`}
        prefetch={false}
        // Même carte que les titres et les albums : pochette carrée, texte
        // dessous, la carte entière qui s'éclaire au survol.
        className="pressable group block rounded-lg p-2 transition-colors duration-200 hover:bg-ink/[0.06]"
        onContextMenu={(e) => {
          e.preventDefault();
          openMenuAt(e.clientX, e.clientY);
        }}
        onTouchStart={longPress.onTouchStart}
        onTouchEnd={longPress.onTouchEnd}
        onTouchMove={longPress.onTouchMove}
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-md bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
          {playlist.coverUrl ? (
            <SafeImage src={playlist.coverUrl} alt={playlist.title} width={220} height={220} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-ink-muted">
              <ListMusic size={28} />
            </div>
          )}

          {/* Hors du lien, posée par-dessus : un lien ne contient pas un
              bouton, et le clic partirait sur la page au lieu de télécharger. */}
          <span
            role="button"
            tabIndex={0}
            aria-label={`Télécharger « ${playlist.title} » pour l'écoute hors connexion`}
            aria-busy={lot.enCours}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              lot.lancer(playlist.title, () => downloadPlaylistForOffline(playlist._id));
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              e.stopPropagation();
              lot.lancer(playlist.title, () => downloadPlaylistForOffline(playlist._id));
            }}
            className="pressable absolute right-2 top-2 z-10 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
          >
            {lot.enCours ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          </span>

          <BoutonLectureCarte
            titres={() => titresDeLaPlaylist(playlist._id)}
            source={{ type: "playlist", label: playlist.title, id: playlist._id }}
            enCours={playSource?.type === "playlist" && playSource.id === playlist._id}
            libelle={playlist.title}
          />
        </div>

        <p className="mt-2.5 line-clamp-1 text-sm font-semibold text-ink">{playlist.title}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <p className="truncate text-xs text-ink-muted">{playlist.songsCount} titres</p>
          {playlist.contributorAvatars && playlist.contributorAvatars.length > 0 && (
            <div className="ml-auto flex -space-x-1.5">
              {playlist.contributorAvatars.map((contributor, i) => (
                <span
                  key={i}
                  className="grid h-5 w-5 place-items-center overflow-hidden rounded-full bg-surface text-[9px] font-semibold text-ink ring-2 ring-base"
                  title={contributor.name}
                >
                  {/* Sans photo, l'initiale de l'artiste plutôt qu'une icône d'image manquante. */}
                  {contributor.coverUrl ? (
                    <SafeImage src={contributor.coverUrl} alt={contributor.name} width={20} height={20} className="h-full w-full object-cover" />
                  ) : (
                    contributor.name.trim().charAt(0).toUpperCase() || "?"
                  )}
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
