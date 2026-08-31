"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Smile,
  Meh,
  Frown,
  Send,
  Clock,
  Trash2,
  Heart,
  CornerDownRight,
} from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { TexteAvecMentions } from "@/components/ui/TexteAvecMentions";
import { ShowMoreButton, useProgressiveList } from "@/components/ui/ShowMore";
import { useToast } from "@/context/ToastProvider";
import { useOnlineStatus } from "@/context/OnlineStatusProvider";
import { enqueueSyncAction } from "@/lib/syncQueue";

type SongComment = {
  _id: string;
  text: string;
  sentiment?: "positive" | "neutral" | "negative";
  likesCount?: number;
  parentComment?: string | null;
  createdAt: string;
  user: { _id: string; name: string; avatarUrl?: string };
  pending?: boolean; // écrit hors-ligne, pas encore synchronisé
};

const sentimentIcon = {
  positive: Smile,
  neutral: Meh,
  negative: Frown,
};

const sentimentColor = {
  positive: "text-verified",
  neutral: "text-ink-muted",
  negative: "text-accent",
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 1) return "à l'instant";
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days} jour${days > 1 ? "s" : ""}`;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

export function CommentsSection({ songId }: { songId: string }) {
  const { status, data: session } = useSession();
  const pushToast = useToast();
  const { isOnline } = useOnlineStatus();
  const [comments, setComments] = useState<SongComment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<SongComment | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/songs/${songId}/comments`);
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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId]);

  // Commentaires racines et leurs réponses (repose sur `parentComment`,
  // déjà supporté par l'API existante mais jusqu'ici inexploité côté UI).
  const { roots, repliesByParent } = useMemo(() => {
    const roots: SongComment[] = [];
    const repliesByParent = new Map<string, SongComment[]>();
    for (const c of comments) {
      if (c.parentComment) {
        const list = repliesByParent.get(c.parentComment) ?? [];
        list.push(c);
        repliesByParent.set(c.parentComment, list);
      } else {
        roots.push(c);
      }
    }
    return { roots, repliesByParent };
  }, [comments]);

  // Un fil de cent commentaires enterrait tout ce qui suit : la section
  // s'ouvre sur les dix premiers. Les réponses d'un commentaire, elles,
  // restent entières — elles se lisent avec celui auquel elles répondent.
  const { visible: visibleRoots, hasMore, remaining, showMore } = useProgressiveList(roots, {
    initial: 10,
    step: 20,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    if (!isOnline) {
      setComments((prev) => [
        {
          _id: `local-${Date.now()}`,
          text,
          createdAt: new Date().toISOString(),
          user: {
            _id: session?.user?.id ?? "local",
            name: session?.user?.name ?? "Toi",
          },
          pending: true,
        },
        ...prev,
      ]);
      await enqueueSyncAction({ type: "add_comment", songId, text });
      setText("");
      pushToast(
        "info",
        "Commentaire enregistré, sera publié à la reconnexion.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/songs/${songId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setComments((prev) => [data.comment, ...prev]);
      setText("");
    } catch {
      pushToast("error", "Le commentaire n'a pas pu être envoyé.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitReply(parentId: string) {
    if (!replyText.trim()) return;
    setSubmittingReply(true);
    try {
      const res = await fetch(`/api/songs/${songId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: replyText, parentComment: parentId }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setComments((prev) => [data.comment, ...prev]);
      setReplyText("");
      setReplyTo(null);
    } catch {
      pushToast("error", "La réponse n'a pas pu être envoyée.");
    } finally {
      setSubmittingReply(false);
    }
  }

  async function deleteComment(id: string) {
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (!res.ok) {
      pushToast("error", "La suppression a échoué.");
      return;
    }
    setComments((prev) =>
      prev.filter((c) => c._id !== id && c.parentComment !== id),
    );
  }

  function renderComment(comment: SongComment, isReply: boolean) {
    const Icon = comment.sentiment ? sentimentIcon[comment.sentiment] : Meh;
    const isMine = session?.user?.id === comment.user._id;
    const replies = repliesByParent.get(comment._id) ?? [];

    return (
      <motion.li
        key={comment._id}
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className={isReply ? "ml-11 mt-3" : ""}
      >
        <div className="flex items-start gap-3">
          <SafeImage
            src={comment.user.avatarUrl}
            alt={comment.user.name}
            width={32}
            height={32}
            className="shrink-0 rounded-full object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-medium">{comment.user.name}</span>
              {isMine && (
                <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                  Toi
                </span>
              )}
              <span className="text-xs text-ink-muted">
                {timeAgo(comment.createdAt)}
              </span>
              {comment.sentiment && (
                <Icon
                  size={12}
                  className={`shrink-0 ${sentimentColor[comment.sentiment]}`}
                />
              )}
            </div>
            <p className="mt-0.5 text-sm text-ink-muted">
              <TexteAvecMentions texte={comment.text} />
            </p>

            {comment.pending && (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-muted">
                <Clock size={10} /> En attente de connexion
              </p>
            )}

            {!comment.pending && (
              <div className="mt-1.5 flex items-center gap-4">
                <span className="flex items-center gap-1 text-xs text-ink-muted">
                  <Heart size={12} /> {comment.likesCount ?? 0}
                </span>
                {!isReply && status === "authenticated" && (
                  <button
                    onClick={() =>
                      setReplyTo(replyTo?._id === comment._id ? null : comment)
                    }
                    className="flex items-center gap-1 text-xs text-ink-muted transition-colors hover:text-accent"
                  >
                    <CornerDownRight size={12} /> Répondre
                  </button>
                )}
                {(isMine || session?.user?.role === "admin") && (
                  <button
                    onClick={() => deleteComment(comment._id)}
                    aria-label="Supprimer le commentaire"
                    className="text-xs text-ink-muted transition-colors hover:text-accent"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            )}

            <AnimatePresence>
              {replyTo?._id === comment._id && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSubmitReply(comment._id);
                  }}
                  className="mt-2.5 flex items-center gap-2 overflow-hidden"
                >
                  <input
                    autoFocus
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Répondre à ${comment.user.name}...`}
                    className="flex-1 rounded-xl border border-border bg-base px-3.5 py-2 text-sm outline-none focus:border-accent"
                  />
                  <button
                    type="submit"
                    disabled={submittingReply}
                    aria-label="Envoyer la réponse"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-base hover:bg-accent-hover disabled:opacity-60"
                  >
                    <Send size={13} />
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>

        {replies.length > 0 && (
          <ul>{replies.map((reply) => renderComment(reply, true))}</ul>
        )}
      </motion.li>
    );
  }

  return (
    <div>
      <h3 className="mb-4 text-sm uppercase tracking-wide text-ink-muted">
        Commentaires {comments.length > 0 && `(${comments.length})`}
      </h3>

      {status === "authenticated" && (
        <form onSubmit={handleSubmit} className="mb-6 flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Dis ce que tu penses de ce son..."
            className="flex-1 rounded-xl border border-border bg-base px-4 py-2.5 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={submitting}
            aria-label="Envoyer"
            className="grid h-10 w-10 place-items-center rounded-full bg-accent text-base hover:bg-accent-hover disabled:opacity-60"
          >
            <Send size={16} />
          </button>
        </form>
      )}

      {loading && <p className="text-sm text-ink-muted">Chargement...</p>}
      {!loading && roots.length === 0 && (
        <p className="text-sm text-ink-muted">Sois le premier à commenter.</p>
      )}

      <ul className="space-y-4">
        <AnimatePresence initial={false}>
          {visibleRoots.map((c) => renderComment(c, false))}
        </AnimatePresence>
      </ul>

      {hasMore && (
        <div className="flex justify-center pt-4">
          <ShowMoreButton label="Voir plus de commentaires" remaining={remaining} onClick={showMore} />
        </div>
      )}
    </div>
  );
}
