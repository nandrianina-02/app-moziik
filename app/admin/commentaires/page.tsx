"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Trash2, Smile, Meh, Frown, Music } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { EqualizerLoader } from "@/components/ui/EqualizerLoader";
import { useToast } from "@/context/ToastProvider";

type AdminComment = {
  _id: string;
  text: string;
  sentiment?: "positive" | "neutral" | "negative";
  createdAt: string;
  user: { name: string };
  song: { _id: string; title: string; coverUrl: string };
};

const sentimentFilters: { value: string; label: string }[] = [
  { value: "", label: "Tous" },
  { value: "positive", label: "Positifs" },
  { value: "neutral", label: "Neutres" },
  { value: "negative", label: "Négatifs" },
];

const sentimentIcon = { positive: Smile, neutral: Meh, negative: Frown } as const;
const sentimentColor = { positive: "text-verified", neutral: "text-ink-muted", negative: "text-accent" } as const;

export default function AdminCommentsPage() {
  const pushToast = useToast();
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [search, setSearch] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (sentiment) params.set("sentiment", sentiment);
      const res = await fetch(`/api/admin/comments?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setComments(data.comments);
    } catch {
      pushToast("error", "Impossible de charger les commentaires.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(load, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sentiment]);

  async function deleteComment(id: string) {
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (!res.ok) {
      pushToast("error", "La suppression a échoué.");
      return;
    }
    pushToast("success", "Commentaire supprimé.");
    setComments((prev) => prev.filter((c) => c._id !== id));
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 flex-1">
          <Search size={16} className="text-ink-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher dans les commentaires..."
            className="bg-transparent text-sm outline-none flex-1"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {sentimentFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => setSentiment(f.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition-colors ${
              sentiment === f.value
                ? "bg-accent text-base border-accent"
                : "border-border text-ink-muted hover:border-accent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="py-10 grid place-items-center">
          <EqualizerLoader />
        </div>
      )}

      <div className="space-y-2">
        {!loading && comments.length === 0 && (
          <p className="text-sm text-ink-muted">Aucun commentaire ne correspond.</p>
        )}

        {comments.map((comment) => {
          const Icon = comment.sentiment ? sentimentIcon[comment.sentiment] : Meh;
          return (
            <div
              key={comment._id}
              className="flex items-start gap-3 rounded-xl2 border border-border bg-surface px-4 py-3.5"
            >
              {comment.song ? (
                <SafeImage src={comment.song.coverUrl} alt={comment.song.title} width={40} height={40} className="rounded-lg object-cover shrink-0" />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-base shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{comment.user?.name ?? "Utilisateur supprimé"}</span>{" "}
                  <span className="text-ink-muted">{comment.text}</span>
                </p>
                {comment.song && (
                  <Link href={`/son/${comment.song._id}`} className="flex items-center gap-1 text-xs text-ink-muted hover:text-accent mt-1">
                    <Music size={11} /> {comment.song.title}
                  </Link>
                )}
              </div>
              {comment.sentiment && (
                <Icon size={14} className={`shrink-0 mt-1 ${sentimentColor[comment.sentiment]}`} />
              )}
              <button
                onClick={() => deleteComment(comment._id)}
                aria-label="Supprimer"
                className="text-ink-muted hover:text-accent p-1 shrink-0"
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
