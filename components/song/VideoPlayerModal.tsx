"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { usePlayer } from "@/context/PlayerProvider";

/**
 * Un clip en plein écran.
 *
 * La lecture audio en cours est mise en pause à l'ouverture : deux sons
 * simultanés ne s'écoutent pas, et personne ne pense à couper le lecteur
 * avant de lancer une vidéo. Elle n'est pas reprise à la fermeture —
 * relancer du son sans qu'on l'ait demandé surprend plus que ça n'aide.
 */
export function VideoPlayerModal({
  videoUrl,
  titre,
  sousTitre,
  href,
  onClose,
}: {
  videoUrl: string;
  titre: string;
  sousTitre?: string;
  /** Lien vers la fiche du titre, quand on n'y est pas déjà. */
  href?: string;
  onClose: () => void;
}) {
  const { isPlaying, togglePlay } = usePlayer();
  const dialogue = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPlaying) togglePlay();
    // Volontairement au montage seul : rejouer cet effet couperait une
    // lecture que l'utilisateur aurait relancée entre-temps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", surTouche);
    dialogue.current?.focus();
    return () => document.removeEventListener("keydown", surTouche);
  }, [onClose]);

  return (
    <div
      ref={dialogue}
      role="dialog"
      aria-modal="true"
      aria-label={`Clip de ${titre}`}
      tabIndex={-1}
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4 outline-none backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl overflow-hidden rounded-xl2 bg-black shadow-2xl"
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video src={videoUrl} controls autoPlay className="aspect-video w-full bg-black" />

        <div className="flex items-center justify-between gap-3 bg-surface px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{titre}</p>
            {sousTitre && <p className="truncate text-xs text-ink-muted">{sousTitre}</p>}
          </div>
          {href && (
            <Link href={href} className="shrink-0 text-xs font-medium text-accent hover:underline">
              Voir le titre
            </Link>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer le clip"
        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <X size={18} />
      </button>
    </div>
  );
}
