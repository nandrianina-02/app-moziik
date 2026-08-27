"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { Send, Loader2, LogIn, Headphones, AlertCircle } from "lucide-react";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { readApiError } from "@/lib/readApiError";
import { useSiteConfig } from "@/context/SiteConfigProvider";

type MessageSupport = {
  _id: string;
  author: "user" | "admin";
  authorName: string;
  body: string;
  createdAt: string;
};

/** Cadence de rafraîchissement pendant que le panneau est ouvert. */
const PERIODE_MS = 5000;

function heure(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function jour(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/**
 * Discussion avec le support.
 *
 * Le rafraîchissement se fait par interrogation périodique, et seulement
 * tant que le panneau est ouvert : le projet n'a pas de canal temps réel,
 * et en ouvrir un pour quelques messages par jour coûterait plus qu'il ne
 * rapporte. Chaque appel ne demande que ce qui suit le dernier message
 * connu, la conversation ne se recharge donc pas en entier.
 *
 * Un compte est nécessaire. Un fil anonyme ne pourrait être retrouvé que
 * par un jeton laissé dans le navigateur, lisible par la personne suivante
 * sur un appareil partagé. Les visiteurs sans compte gardent le formulaire
 * de contact, juste à côté.
 */
export function SupportChat({ onClose }: { onClose: () => void }) {
  const { data: session, status } = useSession();
  const siteConfig = useSiteConfig();

  const [messages, setMessages] = useState<MessageSupport[]>([]);
  const [statutFil, setStatutFil] = useState<"open" | "closed" | null>(null);
  const [chargement, setChargement] = useState(true);
  const [saisie, setSaisie] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const finRef = useRef<HTMLDivElement>(null);
  const dernierRef = useRef<string | null>(null);
  const connecte = status === "authenticated";

  /** Ajoute les messages inédits, en préservant l'ordre chronologique. */
  const fusionner = useCallback((nouveaux: MessageSupport[]) => {
    if (nouveaux.length === 0) return;
    setMessages((prev) => {
      const vus = new Set(prev.map((m) => m._id));
      const ajouts = nouveaux.filter((m) => !vus.has(m._id));
      if (ajouts.length === 0) return prev;
      return [...prev, ...ajouts];
    });
    dernierRef.current = nouveaux[nouveaux.length - 1].createdAt;
  }, []);

  const rafraichir = useCallback(
    async (signal?: AbortSignal) => {
      const params = new URLSearchParams({ open: "1" });
      if (dernierRef.current) params.set("after", dernierRef.current);
      const res = await fetch(`/api/support/thread?${params}`, { signal });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setStatutFil(data.thread?.status ?? null);
      fusionner(data.messages ?? []);
    },
    [fusionner]
  );

  useEffect(() => {
    if (!connecte) {
      setChargement(false);
      return;
    }
    const controleur = new AbortController();
    let minuteur: ReturnType<typeof setTimeout>;

    // Chaîné plutôt que périodique : avec setInterval, une requête lente
    // laisserait s'empiler les suivantes.
    const boucler = async () => {
      try {
        await rafraichir(controleur.signal);
      } catch {
        // Réseau coupé ou onglet en arrière-plan : on retentera au tour
        // suivant, sans rien afficher — le message est déjà enregistré.
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
  }, [connecte, rafraichir]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    const corps = saisie.trim();
    if (!corps || envoi) return;

    setEnvoi(true);
    setErreur(null);
    try {
      const res = await fetch("/api/support/thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: corps }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Le message n'a pas pu être envoyé."));
      const data = await res.json();
      setSaisie("");
      setStatutFil("open");
      fusionner([data.message]);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Le message n'a pas pu être envoyé.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <ModalSheet
      titre="Chat en direct"
      sousTitre={connecte ? `Support ${siteConfig.siteName}` : undefined}
      largeur="sm:max-w-lg"
      onClose={onClose}
      pied={
        connecte ? (
          <form onSubmit={envoyer} className="space-y-2">
            {erreur && (
              <p className="flex items-start gap-1.5 text-xs text-accent">
                <AlertCircle size={13} className="mt-0.5 shrink-0" /> {erreur}
              </p>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={saisie}
                onChange={(e) => setSaisie(e.target.value)}
                onKeyDown={(e) => {
                  // Entrée envoie, Maj+Entrée passe à la ligne : c'est ce
                  // qu'on attend d'une messagerie.
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    envoyer(e);
                  }
                }}
                rows={1}
                maxLength={4000}
                placeholder="Écrivez votre message…"
                aria-label="Votre message"
                className="max-h-32 min-h-[44px] flex-1 resize-y rounded-xl border border-border bg-base px-4 py-2.5 text-sm outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={!saisie.trim() || envoi}
                aria-label="Envoyer"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-base transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                {envoi ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </form>
        ) : undefined
      }
    >
      {status === "loading" ? (
        <p className="flex items-center gap-2 py-10 text-sm text-ink-muted">
          <Loader2 size={15} className="animate-spin" /> Chargement…
        </p>
      ) : !connecte ? (
        <NonConnecte />
      ) : chargement ? (
        <p className="flex items-center gap-2 py-10 text-sm text-ink-muted">
          <Loader2 size={15} className="animate-spin" /> Chargement de la discussion…
        </p>
      ) : (
        <div className="min-h-[16rem] space-y-3">
          {messages.length === 0 ? (
            <Accueil prenom={session?.user?.name ?? null} />
          ) : (
            messages.map((m, i) => {
              const nouveauJour = i === 0 || jour(m.createdAt) !== jour(messages[i - 1].createdAt);
              return (
                <div key={m._id}>
                  {nouveauJour && (
                    <p className="my-3 text-center text-[11px] uppercase tracking-wide text-ink-muted">
                      {jour(m.createdAt)}
                    </p>
                  )}
                  <Bulle message={m} />
                </div>
              );
            })
          )}

          {statutFil === "closed" && messages.length > 0 && (
            <p className="pt-2 text-center text-xs text-ink-muted">
              Cette discussion a été close. Écrivez pour la rouvrir.
            </p>
          )}
          <div ref={finRef} />
        </div>
      )}
    </ModalSheet>
  );
}

function Bulle({ message }: { message: MessageSupport }) {
  const deLEquipe = message.author === "admin";
  return (
    <AnimatePresence initial={false}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className={`flex ${deLEquipe ? "justify-start" : "justify-end"}`}
      >
        <div className={`max-w-[85%] ${deLEquipe ? "" : "text-right"}`}>
          {deLEquipe && (
            <p className="mb-1 flex items-center gap-1.5 text-[11px] text-ink-muted">
              <Headphones size={11} /> {message.authorName || "Support"}
            </p>
          )}
          <div
            // `bg-base` et non `bg-surface` : le corps de la modale est
            // deja en surface, une bulle de la meme couleur ne se
            // detacherait pas du fond.
            className={`rounded-xl2 px-3.5 py-2.5 text-left text-sm ${
              deLEquipe ? "bg-base text-ink" : "bg-accent text-base"
            }`}
          >
            <p className="whitespace-pre-line break-words">{message.body}</p>
          </div>
          <p className="mt-1 text-[11px] text-ink-muted">{heure(message.createdAt)}</p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function Accueil({ prenom }: { prenom: string | null }) {
  return (
    <div className="py-8 text-center">
      <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent">
        <Headphones size={20} />
      </span>
      <p className="text-sm text-ink">
        {prenom ? `Bonjour ${prenom.split(" ")[0]} !` : "Bonjour !"} Comment pouvons-nous vous aider ?
      </p>
      <p className="mx-auto mt-1.5 max-w-xs text-xs text-ink-muted">
        Écrivez ci-dessous : notre équipe vous répond ici même, et vous recevez une notification dès que la
        réponse arrive.
      </p>
    </div>
  );
}

function NonConnecte() {
  return (
    <div className="py-8 text-center">
      <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent">
        <LogIn size={20} />
      </span>
      <p className="text-sm text-ink">Connectez-vous pour discuter avec le support.</p>
      <p className="mx-auto mt-1.5 max-w-sm text-xs text-ink-muted">
        La discussion reste rattachée à votre compte : c&apos;est ce qui permet de retrouver votre historique,
        et d&apos;éviter qu&apos;il s&apos;affiche à la personne suivante sur un appareil partagé.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/connexion?callbackUrl=/contact"
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
        >
          Se connecter
        </Link>
        <span className="text-xs text-ink-muted">ou utilisez le formulaire de contact ci-contre</span>
      </div>
    </div>
  );
}
