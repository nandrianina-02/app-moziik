"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Radio, BadgeCheck, Heart, Users, Share2, UserRound } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { useLongPress } from "@/components/music/useLongPress";
import { ContextMenuShell, MenuItem } from "@/components/ui/ContextMenuShell";
import { ShareModal } from "@/components/share/ShareModal";
import { buildArtistSubject } from "@/components/share/shareSubject";

export function EventsCard({ upcomingCount }: { upcomingCount: number }) {
  return (
    <div className="rounded-xl2 border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <CalendarDays size={16} className="text-accent" /> Évènements
        </h3>
      </div>
      <p className="text-xs text-ink-muted">
        {upcomingCount} évènement{upcomingCount > 1 ? "s" : ""} à venir
      </p>
      <Link href="/evenements" className="mt-3 inline-block text-xs font-medium text-accent hover:underline">
        Voir le calendrier →
      </Link>
    </div>
  );
}

export function RadioCard() {
  return (
    <div className="rounded-xl2 border border-border bg-surface p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-medium">
        <Radio size={16} className="text-accent" /> Radio Moziik
      </h3>
      <p className="text-xs text-ink-muted">Écoutez 24/7</p>
      <Link href="/radio" className="mt-3 inline-block text-xs font-medium text-accent hover:underline">
        Lancer la radio →
      </Link>
    </div>
  );
}

type FeaturedArtist = { _id: string; stageName: string; verified?: boolean; coverUrl?: string; followersCount: number };

export function FeaturedArtists({ artists }: { artists: FeaturedArtist[] }) {
  const [followState, setFollowState] = useState<Record<string, { following: boolean; count: number }>>({});

  async function toggleFollow(artistId: string, baseCount: number) {
    const res = await fetch(`/api/artists/${artistId}/follow`, { method: "POST" });
    if (!res.ok) return;
    const data = await res.json();
    setFollowState((prev) => ({ ...prev, [artistId]: { following: data.following, count: data.followersCount } }));
    void baseCount;
  }

  return (
    <div className="rounded-xl2 border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">Artistes en vedette</h3>
        <Link href="/recherche" className="text-xs text-ink-muted hover:text-ink">
          Voir tout
        </Link>
      </div>
      <div className="space-y-3">
        {artists.map((artist) => {
          const state = followState[artist._id];
          const following = state?.following ?? false;
          const count = state?.count ?? artist.followersCount;
          return (
            <FeaturedArtistRow
              key={artist._id}
              artist={artist}
              following={following}
              count={count}
              onToggleFollow={() => toggleFollow(artist._id, artist.followersCount)}
            />
          );
        })}
      </div>
    </div>
  );
}

function FeaturedArtistRow({
  artist,
  following,
  count,
  onToggleFollow,
}: {
  artist: FeaturedArtist;
  following: boolean;
  count: number;
  onToggleFollow: () => void;
}) {
  const router = useRouter();
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  function openMenuAt(x: number, y: number) {
    setMenuPosition({ x, y });
  }
  const longPress = useLongPress((x, y) => openMenuAt(x, y));

  return (
    <div
      className="flex items-center gap-3"
      onContextMenu={(e) => {
        e.preventDefault();
        openMenuAt(e.clientX, e.clientY);
      }}
      onTouchStart={longPress.onTouchStart}
      onTouchEnd={longPress.onTouchEnd}
      onTouchMove={longPress.onTouchMove}
    >
      <Link href={`/artiste/${artist._id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <SafeImage
          src={artist.coverUrl}
          alt={artist.stageName}
          width={36}
          height={36}
          className="shrink-0 rounded-full object-cover"
        />
        <span className="min-w-0">
          <span className="flex items-center gap-1 truncate text-sm text-ink">
            {artist.stageName}
            {artist.verified && <BadgeCheck size={12} className="shrink-0 text-verified" />}
          </span>
          <span className="flex items-center gap-1 text-xs text-ink-muted">
            <Users size={11} /> {count} abonnés
          </span>
        </span>
      </Link>
      <button
        onClick={onToggleFollow}
        className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
          following ? "border-border text-ink-muted hover:border-accent" : "border-accent text-accent hover:bg-accent/10"
        }`}
      >
        {following ? "Abonné" : "Suivre"}
      </button>

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
          <MenuItem
            icon={UserRound}
            label="Voir le profil"
            onClick={() => {
              router.push(`/artiste/${artist._id}`);
              setMenuPosition(null);
            }}
          />
        </ContextMenuShell>
      )}

      {showShareModal && <ShareModal subject={buildArtistSubject(artist)} onClose={() => setShowShareModal(false)} />}
    </div>
  );
}

type ActivityItem = { type: string; message: string; link: string; at: string };

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 1) return "à l'instant";
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl2 border border-border bg-surface p-4">
      <h3 className="mb-3 text-sm font-medium">Activité récente</h3>
      <div className="space-y-3">
        {items.map((item, i) => (
          <Link key={i} href={item.link} className="block">
            <p className="text-sm text-ink line-clamp-2">{item.message}</p>
            <p className="text-xs text-ink-muted">{timeAgo(item.at)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function SupportArtistsCard() {
  return (
    <div className="rounded-xl2 border border-accent/20 bg-accent/10 p-4">
      <Heart size={20} className="mb-2 text-accent" fill="currentColor" />
      <h3 className="mb-1 text-sm font-medium">Soutiens tes artistes préférés</h3>
      <p className="mb-3 text-xs text-ink-muted">
        Écoute, partage et fais grandir la scène musicale avec Moziik.
      </p>
      <Link href="/abonnement" className="text-xs font-medium text-accent hover:underline">
        En savoir plus →
      </Link>
    </div>
  );
}
