"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { BadgeCheck, UserPlus, UserCheck, Music2, Loader2 } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { useToast } from "@/context/ToastProvider";
import { formatCompactNumber } from "@/lib/formatNumber";
import type { AlbumDetail } from "@/components/album/types";

/**
 * Carte « Créée par » de la maquette : auteur, badge vérifié, bouton
 * Suivre et compteurs.
 *
 * L'état « déjà suivi » se lit via /api/me/followed-artists : la route
 * de suivi n'expose qu'un POST bascule, sans GET pour interroger l'état.
 */
export function AlbumArtistCard({ album, albumsCount }: { album: AlbumDetail; albumsCount: number }) {
  const { status } = useSession();
  const pushToast = useToast();
  const artist = album.artist;

  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState<number | null>(null);
  // La pochette de l'artiste n'est pas dans la charge de l'album non plus.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Le nombre d'abonnés n'est pas dans la charge de l'album (l'artiste y
  // est peuplé sur stageName/verified/bio seulement) : on le lit sur la
  // fiche artiste, accessible sans être connecté.
  useEffect(() => {
    if (!artist) return;
    fetch(`/api/artists/${artist._id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const n = data?.artist?.followersCount;
        if (typeof n === "number") setFollowersCount(n);
        if (typeof data?.artist?.coverUrl === "string") setAvatarUrl(data.artist.coverUrl);
      })
      .catch(() => {});
  }, [artist]);

  useEffect(() => {
    if (status !== "authenticated" || !artist) return;
    fetch("/api/me/followed-artists")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setFollowing((data.artists ?? []).some((a: { _id: string }) => a._id === artist._id));
      })
      .catch(() => {});
  }, [status, artist]);

  if (!artist) return null;

  async function toggleFollow() {
    if (status !== "authenticated") {
      pushToast("error", "Connecte-toi pour suivre cet artiste.");
      return;
    }
    setBusy(true);
    const optimiste = !following;
    setFollowing(optimiste);
    try {
      const res = await fetch(`/api/artists/${artist!._id}/follow`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFollowing(data.following);
      setFollowersCount(data.followersCount);
      pushToast("success", data.following ? "Artiste suivi." : "Tu ne suis plus cet artiste.");
    } catch {
      setFollowing(!optimiste);
      pushToast("error", "Échec de l'action.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl2 border border-border bg-surface p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-medium">
        <Music2 size={14} className="text-accent" /> Créé par
      </h3>

      <div className="flex items-center gap-3">
        {avatarUrl ? (
          <SafeImage
            src={avatarUrl}
            alt={artist.stageName}
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-base text-ink-muted">
            <Music2 size={18} />
          </span>
        )}

        <Link href={`/artiste/${artist._id}`} className="min-w-0 flex-1">
          <span className="flex items-center gap-1 truncate text-sm font-medium transition-colors hover:text-accent">
            {artist.stageName}
            {artist.verified && <BadgeCheck size={13} className="shrink-0 text-verified" />}
          </span>
          <span className="block text-xs text-ink-muted">Artiste</span>
        </Link>

        <button
          onClick={toggleFollow}
          disabled={busy}
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-colors disabled:opacity-60 ${
            following
              ? "border border-border text-ink-muted hover:text-ink"
              : "bg-accent text-base hover:bg-accent-hover"
          }`}
        >
          {busy ? (
            <Loader2 size={13} className="animate-spin" />
          ) : following ? (
            <UserCheck size={13} />
          ) : (
            <UserPlus size={13} />
          )}
          {following ? "Suivi" : "Suivre"}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 divide-x divide-border border-t border-border pt-3 text-center">
        <div>
          <p className="text-sm font-medium">
            {followersCount === null ? "—" : formatCompactNumber(followersCount)}
          </p>
          <p className="text-xs text-ink-muted">Abonnés</p>
        </div>
        <div>
          <p className="text-sm font-medium">{albumsCount}</p>
          <p className="text-xs text-ink-muted">Sorties</p>
        </div>
      </div>
    </div>
  );
}
