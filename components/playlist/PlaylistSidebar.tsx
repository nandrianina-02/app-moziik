"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Share2, Check, Link2, ListMusic, User as UserIcon, Info } from "lucide-react";
import { FaFacebook, FaXTwitter, FaWhatsapp } from "react-icons/fa6";
import { SafeImage } from "@/components/ui/SafeImage";
import { SidebarSection } from "@/components/song/SidebarSection";
import { useToast } from "@/context/ToastProvider";
import { formatCompactNumber } from "@/lib/formatNumber";
import type { PlaylistDetail, PlaylistSummaryLite } from "@/components/playlist/types";

/**
 * Colonne latérale de la page playlist, symétrique d'AlbumSidebar :
 * mêmes cartes, mêmes proportions, mêmes libellés. Les métriques d'une
 * playlist étant agrégées depuis ses titres, elles sont calculées par la
 * page et reçues ici déjà additionnées.
 */
export function PlaylistSidebar({
  playlist,
  totalPlays,
  totalLikes,
  otherPlaylists,
}: {
  playlist: PlaylistDetail;
  totalPlays: number;
  totalLikes: number;
  otherPlaylists: PlaylistSummaryLite[];
}) {
  const pushToast = useToast();
  const [copied, setCopied] = useState(false);

  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/playlist/${playlist._id}`;
  const shareText = `${playlist.title} — ${playlist.owner?.name ?? "Moziik"}`;

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    pushToast("success", "Lien copié dans le presse-papiers.");
    setTimeout(() => setCopied(false), 2000);
  }

  const metrics = [
    { label: "Écoutes", value: totalPlays },
    { label: "Likes", value: totalLikes },
    { label: "Titres", value: playlist.songs.length },
    { label: "Abonnés", value: playlist.followers?.length ?? 0 },
  ];
  const max = Math.max(1, ...metrics.map((m) => m.value));

  return (
    <div className="space-y-4">
      {playlist.description && (
        <div className="rounded-xl2 border border-border bg-surface p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <Info size={14} className="text-accent" /> À propos de cette playlist
          </h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">{playlist.description}</p>
        </div>
      )}

      <div className="rounded-xl2 border border-border bg-surface p-4">
        <h3 className="mb-3 text-sm font-medium">Statistiques</h3>
        <div className="space-y-3.5">
          {metrics.map((m) => (
            <div key={m.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-ink-muted">{m.label}</span>
                <span className="font-medium">{formatCompactNumber(m.value)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-base">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(m.value / max) * 100}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-full rounded-full bg-accent"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl2 border border-border bg-surface p-4">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-medium">
          <UserIcon size={14} className="text-accent" /> Créée par
        </h3>
        <div className="flex items-center gap-3">
          {playlist.owner?.avatarUrl ? (
            <SafeImage
              src={playlist.owner.avatarUrl}
              alt={playlist.owner.name ?? ""}
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-base text-ink-muted">
              <UserIcon size={17} />
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">
              {playlist.owner?.name ?? "Utilisateur supprimé"}
            </span>
            <span className="block text-xs text-ink-muted">
              {playlist.isPublic ? "Playlist publique" : "Playlist privée"}
            </span>
          </span>
        </div>
      </div>

      {/* Une playlist privée n'a pas de lien partageable : proposer les
          boutons donnerait un lien inaccessible au destinataire. */}
      {playlist.isPublic && (
        <div className="rounded-xl2 border border-border bg-surface p-4">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-medium">
            <Share2 size={14} className="text-accent" /> Partager cette playlist
          </h3>
          <div className="flex items-center gap-2">
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Partager sur Facebook"
              className="grid h-9 w-9 place-items-center rounded-full bg-base text-ink-muted transition-colors hover:text-accent"
            >
              <FaFacebook size={16} />
            </a>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Partager sur X"
              className="grid h-9 w-9 place-items-center rounded-full bg-base text-ink-muted transition-colors hover:text-accent"
            >
              <FaXTwitter size={16} />
            </a>
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Partager sur WhatsApp"
              className="grid h-9 w-9 place-items-center rounded-full bg-base text-ink-muted transition-colors hover:text-accent"
            >
              <FaWhatsapp size={16} />
            </a>
            <button
              onClick={copyLink}
              aria-label="Copier le lien"
              className="grid h-9 w-9 place-items-center rounded-full bg-base text-ink-muted transition-colors hover:text-accent"
            >
              {copied ? <Check size={16} className="text-verified" /> : <Link2 size={16} />}
            </button>
          </div>
        </div>
      )}

      <SidebarSection
        icon={ListMusic}
        title="Playlists similaires"
        viewAllHref="/bibliotheque"
        isEmpty={otherPlaylists.length === 0}
        emptyLabel="Aucune autre playlist publique pour l'instant."
      >
        {otherPlaylists.map((p) => (
          <Link
            key={p._id}
            href={`/playlist/${p._id}`}
            className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-base"
          >
            {p.coverUrl ? (
              <SafeImage
                src={p.coverUrl}
                alt={p.title}
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-base text-ink-muted">
                <ListMusic size={16} />
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{p.title}</span>
              <span className="block text-xs text-ink-muted">{p.songs?.length ?? 0} titres</span>
            </span>
          </Link>
        ))}
      </SidebarSection>
    </div>
  );
}
