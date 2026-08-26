"use client";

import { useState } from "react";
import { Play, ListPlus, Share2, UserPlus, UserCheck } from "lucide-react";
import { usePlayer, type PlayableSong } from "@/context/PlayerProvider";
import { useToast } from "@/context/ToastProvider";
import { ContextMenuShell, MenuItem, MenuSeparator } from "@/components/ui/ContextMenuShell";
import { ShareModal } from "@/components/share/ShareModal";
import { buildArtistSubject } from "@/components/share/shareSubject";

export type ArtistMenuTarget = {
  _id: string;
  stageName: string;
  verified?: boolean;
  coverUrl?: string;
  followersCount?: number;
  songsCount?: number;
  albumsCount?: number;
};

export function ArtistContextMenu({
  artist,
  songs,
  position,
  isOwnProfile,
  following,
  onToggleFollow,
  onClose,
}: {
  artist: ArtistMenuTarget;
  songs?: PlayableSong[];
  position: { x: number; y: number };
  isOwnProfile?: boolean;
  following?: boolean;
  onToggleFollow?: () => void;
  onClose: () => void;
}) {
  const pushToast = useToast();
  const { playQueue, enqueue } = usePlayer();
  const [showShareModal, setShowShareModal] = useState(false);
  const hasSongs = (songs?.length ?? 0) > 0;

  return (
    <>
      {!showShareModal && (
        <ContextMenuShell anchor={position} onClose={onClose}>
          {hasSongs && (
            <>
              <MenuItem
                icon={Play}
                label="Écouter tous les titres"
                onClick={() => {
                  playQueue(songs!, 0, { type: "artist", label: artist.stageName, id: artist._id });
                  onClose();
                }}
              />
              <MenuItem
                icon={ListPlus}
                label="Ajouter à la file d'attente"
                onClick={() => {
                  songs!.forEach((s) => enqueue(s));
                  pushToast(
                    "success",
                    songs!.length > 1 ? `${songs!.length} titres ajoutés à la file d'attente.` : "Ajouté à la file d'attente."
                  );
                  onClose();
                }}
              />
            </>
          )}
          <MenuItem
            icon={Share2}
            label={isOwnProfile ? "Partager mon profil" : "Partager"}
            onClick={() => setShowShareModal(true)}
          />
          {!isOwnProfile && onToggleFollow && (
            <>
              <MenuSeparator />
              <MenuItem
                icon={following ? UserCheck : UserPlus}
                label={following ? "Ne plus suivre" : "Suivre"}
                onClick={() => {
                  onToggleFollow();
                  onClose();
                }}
              />
            </>
          )}
        </ContextMenuShell>
      )}

      {showShareModal && (
        <ShareModal
          subject={buildArtistSubject(artist, isOwnProfile)}
          onClose={() => {
            setShowShareModal(false);
            onClose();
          }}
        />
      )}
    </>
  );
}
