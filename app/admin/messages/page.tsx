"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Loader2, Headphones, Check, RotateCcw, Inbox, Mail } from "lucide-react";
import { AdminCardsSkeleton } from "@/components/admin/AdminSkeleton";
import { useToast } from "@/context/ToastProvider";
import { readApiError } from "@/lib/readApiError";

type Fil = {
  _id: string;
  userName: string;
  userEmail: string;
  status: "open" | "closed";
  lastMessageAt: string;
  lastMessagePreview: string;
  lastMessageFrom: "user" | "admin";
  unreadForAdmin: number;
  user?: { _id: string; name?: string; email?: string } | null;
};

type Message = {
  _id: string;
  author: "user" | "admin";
  authorName: string;
  body: string;
  createdAt: string;
};

const PERIODE_MS = 6000;

function quand(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const aujourdhui = new Date().toDateString() === d.toDateString();
  return aujourdhui
    ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/**
 * Boîte de réception du support.
 *
 * La liste et le fil ouvert se rafraîchissent par interrogation
 * périodique, comme le panneau côté membre — sans canal temps réel, c'est
 * la seule façon de voir arriver un message sans recharger la page. Le
 * fil ne demande que ce qui suit le dernier message connu.
 */
export default function AdminMessagesPage() {
  const pushToast = useToast();
  const [fils, setFils] = useState<Fil[]>([]);
  const [filtre, setFiltre] = useState<"tous" | "open" | "closed">("tous");
  const [chargement, setChargement] = useState(true);

  const [ouvert, setOuvert] = useState<Fil | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chargementFil, setChargementFil] = useState(false);
  const [reponse, setReponse] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const dernierRef = useRef<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  const chargerListe = useCallback(
    async (signal?: AbortSignal) => {
      const params = filtre === "tous" ? "" : `?status=${filtre}`;
      const res = await fetch(`/api/admin/support${params}`, { signal });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFils(data.threads);
    },
    [filtre]
  );

  useEffect(() => {
    const controleur = new AbortController();
    let minuteur: ReturnType<typeof setTimeout>;
    const boucler = async () => {
      try {
        await chargerListe(controleur.signal);
      } catch {
        // Rafraîchissement de fond : un échec ponctuel ne mérite pas
        // d'alerter, le tour suivant réessaiera.
      } finally {
        setChargement(false);
        if (!controleur.signal.aborted) minuteur = setTimeout(boucler, PERIODE_MS);
      }
    };
    boucler();
    return () => {
      controleur.abort();
      clearTimeout(minuteur);
    };
  }, [chargerListe]);

  const fusionner = useCallback((nouveaux: Message[]) => {
    if (nouveaux.length === 0) return;
    setMessages((prev) => {
      const vus = new Set(prev.map((m) => m._id));
      const ajouts = nouveaux.filter((m) => !vus.has(m._id));
      return ajouts.length === 0 ? prev : [...prev, ...ajouts];
    });
    dernierRef.current = nouveaux[nouveaux.length - 1].createdAt;
  }, []);

  useEffect(() => {
    if (!ouvert) return;
    const controleur = new AbortController();
    let minuteur: ReturnType<typeof setTimeout>;

    const boucler = async () => {
      try {
        const params = dernierRef.current ? `?after=${encodeURIComponent(dernierRef.current)}` : "";
        const res = await fetch(`/api/admin/support/${ouvert._id}${params}`, { signal: controleur.signal });
        if (!res.ok) throw new Error();
        const data = await res.json();
        fusionner(data.messages ?? []);
      } catch {
        // idem : on retente au tour suivant
      } finally {
        setChargementFil(false);
        if (!controleur.signal.aborted) minuteur = setTimeout(boucler, PERIODE_MS);
      }
    };
    boucler();

    return () => {
      controleur.abort();
      clearTimeout(minuteur);
    };
  }, [ouvert, fusionner]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  function ouvrir(fil: Fil) {
    dernierRef.current = null;
    setMessages([]);
    setChargementFil(true);
    setReponse("");
    setOuvert(fil);
    // La consultation vaut lecture : le compteur repart à zéro côté
    // serveur, on le reflète tout de suite dans la liste.
    setFils((prev) => prev.map((f) => (f._id === fil._id ? { ...f, unreadForAdmin: 0 } : f)));
  }

  async function repondre(e: React.FormEvent) {
    e.preventDefault();
    const corps = reponse.trim();
    if (!ouvert || !corps || envoi) return;
    setEnvoi(true);
    try {
      const res = await fetch(`/api/admin/support/${ouvert._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: corps }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "La réponse n'a pas pu être envoyée."));
      const data = await res.json();
      setReponse("");
      fusionner([data.message]);
      setOuvert({ ...ouvert, status: "open" });
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "La réponse n'a pas pu être envoyée.");
    } finally {
      setEnvoi(false);
    }
  }

  async function changerStatut(statut: "open" | "closed") {
    if (!ouvert) return;
    try {
      const res = await fetch(`/api/admin/support/${ouvert._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statut }),
      });
      if (!res.ok) throw new Error();
      setOuvert({ ...ouvert, status: statut });
      setFils((prev) => prev.map((f) => (f._id === ouvert._id ? { ...f, status: statut } : f)));
      pushToast("success", statut === "closed" ? "Discussion close." : "Discussion rouverte.");
    } catch {
      pushToast("error", "Le changement a échoué.");
    }
  }

  const enAttente = fils.filter((f) => f.unreadForAdmin > 0).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-display font-bold">Messages</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Les discussions ouvertes depuis la page de contact.
          {enAttente > 0 && (
            <span className="ml-1 text-accent">
              {enAttente} en attente de réponse.
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["tous", "Toutes"],
            ["open", "Ouvertes"],
            ["closed", "Closes"],
          ] as const
        ).map(([valeur, libelle]) => (
          <button
            key={valeur}
            type="button"
            onClick={() => setFiltre(valeur)}
            aria-pressed={filtre === valeur}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              filtre === valeur
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-ink-muted hover:text-ink"
            }`}
          >
            {libelle}
          </button>
        ))}
      </div>

      {chargement ? (
        <AdminCardsSkeleton count={4} cols={1} />
      ) : fils.length === 0 ? (
        <div className="rounded-xl2 border border-border bg-surface px-6 py-12 text-center">
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-base text-ink-muted">
            <Inbox size={20} />
          </span>
          <p className="text-sm text-ink">Aucune discussion pour l&apos;instant.</p>
          <p className="mt-1 text-xs text-ink-muted">
            Les membres ouvrent une discussion depuis « Chat en direct », sur la page de contact.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
          {/* Liste — masquée sur mobile quand un fil est ouvert, l'écran
              étant trop étroit pour les deux. */}
          <ul className={`space-y-2 ${ouvert ? "hidden lg:block" : ""}`}>
            {fils.map((fil) => {
              const actif = ouvert?._id === fil._id;
              const attend = fil.unreadForAdmin > 0;
              return (
                <li key={fil._id}>
                  <button
                    type="button"
                    onClick={() => ouvrir(fil)}
                    className={`w-full rounded-xl2 border p-3.5 text-left transition-colors ${
                      actif ? "border-accent bg-surface" : "border-border bg-surface hover:border-accent"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-ink">
                            {fil.user?.name || fil.userName || "Membre"}
                          </span>
                          {attend && (
                            <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-accent px-1 text-[9px] font-semibold text-base">
                              {fil.unreadForAdmin}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-ink-muted">
                          {fil.user?.email || fil.userEmail}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] text-ink-muted">{quand(fil.lastMessageAt)}</span>
                    </div>
                    <p className="mt-1.5 truncate text-xs text-ink-muted">
                      {fil.lastMessageFrom === "admin" && <span className="text-ink-muted">Vous : </span>}
                      {fil.lastMessagePreview || "—"}
                    </p>
                    {fil.status === "closed" && (
                      <span className="mt-2 inline-block rounded-full bg-ink-muted/15 px-2 py-0.5 text-[10px] text-ink-muted">
                        Close
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {ouvert ? (
            <div className="flex min-h-[28rem] flex-col rounded-xl2 border border-border bg-surface">
              <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
                <button
                  type="button"
                  onClick={() => setOuvert(null)}
                  aria-label="Retour à la liste"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-base hover:text-ink lg:hidden"
                >
                  <ArrowLeft size={16} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {ouvert.user?.name || ouvert.userName || "Membre"}
                  </p>
                  <a
                    href={`mailto:${ouvert.user?.email || ouvert.userEmail}`}
                    className="flex items-center gap-1 truncate text-xs text-ink-muted hover:text-accent"
                  >
                    <Mail size={11} /> {ouvert.user?.email || ouvert.userEmail}
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => changerStatut(ouvert.status === "closed" ? "open" : "closed")}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"
                >
                  {ouvert.status === "closed" ? (
                    <>
                      <RotateCcw size={12} /> Rouvrir
                    </>
                  ) : (
                    <>
                      <Check size={12} /> Clore
                    </>
                  )}
                </button>
              </div>

              <div className="max-h-[26rem] flex-1 space-y-3 overflow-y-auto p-4">
                {chargementFil ? (
                  <p className="flex items-center gap-2 text-sm text-ink-muted">
                    <Loader2 size={15} className="animate-spin" /> Chargement…
                  </p>
                ) : messages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink-muted">Discussion vide.</p>
                ) : (
                  messages.map((m) => (
                    <div key={m._id} className={`flex ${m.author === "admin" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] ${m.author === "admin" ? "text-right" : ""}`}>
                        <p className="mb-1 flex items-center gap-1.5 text-[11px] text-ink-muted">
                          {m.author === "admin" && <Headphones size={11} />}
                          {m.authorName || (m.author === "admin" ? "Support" : "Membre")}
                          <span>· {quand(m.createdAt)}</span>
                        </p>
                        <div
                          className={`rounded-xl2 px-3.5 py-2.5 text-left text-sm ${
                            m.author === "admin" ? "bg-accent text-base" : "bg-base text-ink"
                          }`}
                        >
                          <p className="whitespace-pre-line break-words">{m.body}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={finRef} />
              </div>

              <form onSubmit={repondre} className="flex items-end gap-2 border-t border-border p-4">
                <textarea
                  value={reponse}
                  onChange={(e) => setReponse(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      repondre(e);
                    }
                  }}
                  rows={1}
                  maxLength={4000}
                  placeholder="Votre réponse…"
                  aria-label="Votre réponse"
                  className="max-h-32 min-h-[44px] flex-1 resize-y rounded-xl border border-border bg-base px-4 py-2.5 text-sm outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={!reponse.trim() || envoi}
                  aria-label="Envoyer la réponse"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-base transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  {envoi ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </form>
            </div>
          ) : (
            <div className="hidden place-items-center rounded-xl2 border border-border bg-surface p-10 text-center lg:grid">
              <div>
                <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-base text-ink-muted">
                  <Inbox size={20} />
                </span>
                <p className="text-sm text-ink-muted">Choisissez une discussion pour la lire et y répondre.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
