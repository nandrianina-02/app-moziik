"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, Trash2, Smile, Meh, Frown, Music, Flag, Sparkles, Loader2 } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { AdminCardsSkeleton } from "@/components/admin/AdminSkeleton";
import { useToast } from "@/context/ToastProvider";
import { useIADisponible } from "@/context/SiteConfigProvider";
import { libelleMotif } from "@/lib/ai/labels";

type AdminComment = {
  _id: string;
  text: string;
  sentiment?: "positive" | "neutral" | "negative";
  flagged?: boolean;
  flagLabels?: string[];
  flagNote?: string;
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

/**
 * Modération des commentaires.
 *
 * La relecture par l'IA ne masque rien : elle signale, l'équipe décide.
 * C'est ce qui autorise à la faire par lots plutôt qu'à la publication —
 * un retard de quelques minutes ne laisse rien passer qui aurait été
 * bloqué autrement (voir lib/ai/moderationQueue.ts).
 *
 * La file en attente se vide à l'ouverture de cette page, et seulement
 * s'il y a quelque chose dedans : c'est ici que le retard se verrait,
 * autant le rattraper au moment où quelqu'un regarde.
 */
export default function AdminCommentsPage() {
  const pushToast = useToast();
  const moderationDispo = useIADisponible("moderation");

  const [comments, setComments] = useState<AdminComment[]>([]);
  const [search, setSearch] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [signalesSeuls, setSignalesSeuls] = useState(false);
  const [enAttente, setEnAttente] = useState(0);
  const [totalSignales, setTotalSignales] = useState(0);
  const [loading, setLoading] = useState(true);
  const [analyse, setAnalyse] = useState(false);

  // Le rattrapage automatique n'a lieu qu'une fois par visite : sans ce
  // verrou, chaque frappe dans la recherche relancerait un appel payant.
  const rattrapageFait = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (sentiment) params.set("sentiment", sentiment);
      if (signalesSeuls) params.set("flagged", "1");
      const res = await fetch(`/api/admin/comments?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setComments(data.comments);
      setEnAttente(data.enAttente ?? 0);
      setTotalSignales(data.totalSignales ?? 0);
      return data.enAttente ?? 0;
    } catch {
      pushToast("error", "Impossible de charger les commentaires.");
      return 0;
    } finally {
      setLoading(false);
    }
  }, [search, sentiment, signalesSeuls, pushToast]);

  const analyser = useCallback(
    async (silencieux: boolean) => {
      setAnalyse(true);
      try {
        const res = await fetch("/api/admin/comments", { method: "POST" });
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!silencieux) {
          if (data.raison === "indisponible") pushToast("info", "L'assistance par IA n'est pas disponible.");
          else if (data.relus === 0) pushToast("info", "Aucun commentaire en attente de relecture.");
          else
            pushToast(
              "success",
              `${data.relus} commentaire${data.relus > 1 ? "s" : ""} relu${data.relus > 1 ? "s" : ""}, ${data.signales} signalé${data.signales > 1 ? "s" : ""}.`
            );
        }
        if (data.relus > 0) await load();
        else setEnAttente(data.restants ?? 0);
      } catch {
        if (!silencieux) pushToast("error", "La relecture a échoué.");
      } finally {
        setAnalyse(false);
      }
    },
    [load, pushToast]
  );

  useEffect(() => {
    const timeout = setTimeout(async () => {
      const restants = await load();
      if (!rattrapageFait.current && moderationDispo && restants > 0) {
        rattrapageFait.current = true;
        void analyser(true);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [load, analyser, moderationDispo]);

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
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2">
          <Search size={16} className="text-ink-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher dans les commentaires..."
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        {moderationDispo && (
          <button
            type="button"
            onClick={() => analyser(false)}
            disabled={analyse}
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
          >
            {analyse ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {analyse ? "Relecture…" : enAttente > 0 ? `Relire ${enAttente} en attente` : "Relire les commentaires"}
          </button>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {sentimentFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setSentiment(f.value);
              setSignalesSeuls(false);
            }}
            aria-pressed={!signalesSeuls && sentiment === f.value}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              !signalesSeuls && sentiment === f.value
                ? "border-accent bg-accent text-base"
                : "border-border text-ink-muted hover:border-accent"
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setSignalesSeuls((v) => !v);
            setSentiment("");
          }}
          aria-pressed={signalesSeuls}
          className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
            signalesSeuls ? "border-accent bg-accent text-base" : "border-border text-ink-muted hover:border-accent"
          }`}
        >
          <Flag size={12} /> Signalés{totalSignales > 0 ? ` (${totalSignales})` : ""}
        </button>
      </div>

      {loading && <AdminCardsSkeleton count={6} cols={1} />}

      <div className="space-y-2">
        {!loading && comments.length === 0 && (
          <p className="text-sm text-ink-muted">
            {signalesSeuls ? "Aucun commentaire signalé — rien à trancher." : "Aucun commentaire ne correspond."}
          </p>
        )}

        {comments.map((comment) => {
          const Icon = comment.sentiment ? sentimentIcon[comment.sentiment] : Meh;
          return (
            <div
              key={comment._id}
              className={`flex items-start gap-3 rounded-xl2 border bg-surface px-4 py-3.5 ${
                comment.flagged ? "border-accent/50" : "border-border"
              }`}
            >
              {comment.song ? (
                <SafeImage
                  src={comment.song.coverUrl}
                  alt={comment.song.title}
                  width={40}
                  height={40}
                  className="shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="h-10 w-10 shrink-0 rounded-lg bg-base" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">{comment.user?.name ?? "Utilisateur supprimé"}</span>{" "}
                  <span className="text-ink-muted">{comment.text}</span>
                </p>

                {comment.flagged && (
                  <div className="mt-2 rounded-lg border border-accent/30 bg-base px-3 py-2">
                    <p className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <Flag size={11} className="shrink-0 text-accent" />
                      {(comment.flagLabels ?? []).map((motif) => (
                        <span
                          key={motif}
                          className="rounded-full bg-accent/15 px-2 py-0.5 font-medium text-accent"
                        >
                          {libelleMotif(motif)}
                        </span>
                      ))}
                    </p>
                    {comment.flagNote && <p className="mt-1.5 text-xs text-ink-muted">{comment.flagNote}</p>}
                    <p className="mt-1.5 text-[11px] text-ink-muted">
                      Signalé par l&apos;IA — le commentaire reste visible tant que vous ne le supprimez pas.
                    </p>
                  </div>
                )}

                {comment.song && (
                  <Link
                    href={`/son/${comment.song._id}`}
                    className="mt-1 flex items-center gap-1 text-xs text-ink-muted hover:text-accent"
                  >
                    <Music size={11} /> {comment.song.title}
                  </Link>
                )}
              </div>
              {comment.sentiment && (
                <Icon size={14} className={`mt-1 shrink-0 ${sentimentColor[comment.sentiment]}`} />
              )}
              <button
                onClick={() => deleteComment(comment._id)}
                aria-label="Supprimer"
                className="shrink-0 p-1 text-ink-muted hover:text-accent"
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
