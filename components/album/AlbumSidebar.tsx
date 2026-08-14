"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Disc3, Share2, Check, Link2 } from "lucide-react";
import { FaFacebook, FaXTwitter, FaWhatsapp } from "react-icons/fa6";
import { AlbumInfoCard } from "@/components/album/AlbumInfoCard";
import { AlbumArtistCard } from "@/components/album/AlbumArtistCard";
import { SidebarSection } from "@/components/song/SidebarSection";
import { CompactAlbumRow } from "@/components/song/CompactAlbumRow";
import { useToast } from "@/context/ToastProvider";
import { formatCompactNumber } from "@/lib/formatNumber";
import type { AlbumDetail, AlbumSummaryLite } from "@/components/album/types";

export function AlbumSidebar({
  album,
  totalPlays,
  totalLikes,
  totalShares,
  moreFromArtist,
}: {
  album: AlbumDetail;
  totalPlays: number;
  totalLikes: number;
  totalShares: number;
  moreFromArtist: AlbumSummaryLite[];
}) {
  const pushToast = useToast();
  const [copied, setCopied] = useState(false);

  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/album/${album._id}`;
  const shareText = `${album.title} — ${album.artist?.stageName ?? "Moziik"}`;

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    pushToast("success", "Lien copié dans le presse-papiers.");
    setTimeout(() => setCopied(false), 2000);
  }

  const metrics = [
    { label: "Écoutes", value: totalPlays },
    { label: "Likes", value: totalLikes },
    { label: "Partages", value: totalShares },
    { label: "Téléchargements", value: album.downloadsCount ?? 0 },
  ];
  const max = Math.max(1, ...metrics.map((m) => m.value));

  return (
    <div className="space-y-4">
      <AlbumArtistCard album={album} albumsCount={moreFromArtist.length + 1} />
      <AlbumInfoCard album={album} />

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
          <Share2 size={14} className="text-accent" /> Partager cet album
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

      {album.artist && (
        <SidebarSection
          icon={Disc3}
          title={`Plus de ${album.artist.stageName}`}
          viewAllHref={`/artiste/${album.artist._id}`}
          isEmpty={moreFromArtist.length === 0}
          emptyLabel="Aucun autre album publié pour l'instant."
        >
          {moreFromArtist.map((a) => (
            <CompactAlbumRow key={a._id} album={a} />
          ))}
        </SidebarSection>
      )}
    </div>
  );
}
