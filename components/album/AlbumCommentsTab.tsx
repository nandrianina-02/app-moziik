"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";
import { MessageSquare } from "lucide-react";
import { ShowMoreButton, useProgressiveList } from "@/components/ui/ShowMore";
import type { AlbumComment } from "@/components/album/types";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 1) return "à l'instant";
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days} jour${days > 1 ? "s" : ""}`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function AlbumCommentsTab({ albumId }: { albumId: string }) {
  const [comments, setComments] = useState<AlbumComment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/albums/${albumId}/comments`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setComments(data.comments))
      .finally(() => setLoading(false));
  }, [albumId]);

  // Appelé avant les retours anticipés : un crochet ne peut pas dépendre
  // de l'état de chargement.
  const { visible, hasMore, remaining, showMore } = useProgressiveList(comments, { initial: 10, step: 20 });

  if (loading) {
    return <p className="rounded-xl2 border border-border bg-surface p-6 text-sm text-ink-muted">Chargement...</p>;
  }

  if (comments.length === 0) {
    return (
      <p className="rounded-xl2 border border-dashed border-border p-8 text-center text-sm text-ink-muted">
        Aucun commentaire pour le moment sur les titres de cet album.
      </p>
    );
  }

  return (
    <div className="rounded-xl2 border border-border bg-surface p-5">
      <p className="mb-4 flex items-center gap-1.5 text-xs text-ink-muted">
        <MessageSquare size={13} />
        Commentaires laissés sur les titres de l&apos;album — ouvre un titre pour répondre.
      </p>
      <ul className="space-y-4">
        {visible.map((c) => (
          <li key={c._id} className="flex items-start gap-3">
            <SafeImage
              src={c.user.avatarUrl}
              alt={c.user.name}
              width={32}
              height={32}
              className="shrink-0 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-medium">{c.user.name}</span>
                <span className="text-xs text-ink-muted">{timeAgo(c.createdAt)}</span>
              </div>
              <p className="mt-0.5 text-sm text-ink-muted">{c.text}</p>
              {c.songTitle && (
                <Link href={`/son/${c.song}`} className="mt-1 inline-block text-xs text-accent hover:underline">
                  sur « {c.songTitle} »
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>

      {hasMore && (
        <div className="flex justify-center pt-4">
          <ShowMoreButton label="Voir plus de commentaires" remaining={remaining} onClick={showMore} />
        </div>
      )}
    </div>
  );
}
