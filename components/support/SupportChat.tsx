"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { Send, Loader2, LogIn, Headphones, AlertCircle, Sparkles, UserRound } from "lucide-react";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { readApiError } from "@/lib/readApiError";
import { useSiteConfig } from "@/context/SiteConfigProvider";

type MessageSupport = {
  _id: string;
  author: "user" | "admin" | "ai";
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
 * Un assistant répond d'abord, quand il est disponible. Trois choix le
 * gouvernent, tous visibles à l'écran :
 *
 * - il se présente comme une machine à chaque bulle, sans exception ;
 * - « Parler à l'équipe » reste offert en permanence, sans avoir à
 *   argumenter ni à échouer d'abord ;
 * - il se retire du fil dès qu'on le lui demande, ou dès qu'il reconnaît
 *   ne pas savoir. Le fil part alors à l'équipe, qui voit tout depuis le
 *   début.
 *
 * L'envoi et la réponse de l'assistant sont deux requêtes distinctes : le
 * message part et s'affiche tout de suite, la réponse arrive quelques
 * secondes plus tard. Enchaîner les deux ferait passer l'enregistrement du
 * message pour lent, et un assistant indisponible ferait échouer l'envoi.
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
  const [assistantActif, setAssistantActif] = useState(false);
  const [humainDemande, setHumainDemande] = useState(false);
  const [assistantEcrit, setAssistantEcrit] = useState(false);
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
      setAssistantActif(Boolean(data.assistant));
      setHumainDemande(Boolean(data.thread?.humanRequested));
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
  }, [messages.length, assistantEcrit]);

  /**
   * Va chercher la réponse de l'assistant.
   *
   * Sans bruit en cas d'échec : le message du membre est enregistré, le
   * fil est dans la boîte de l'équipe, et annoncer « l'assistant n'a pas
   * pu répondre » n'apprendrait rien d'utile à qui attend de l'aide.
   */
  const demanderAssistant = useCallback(async () => {
    setAssistantEcrit(true);
    try {
      const res = await fetch("/api/support/assist", { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.message) fusionner([data.message]);
      if (data.escalade) setHumainDemande(true);
    } catch {
      // idem : silence volontaire.
    } finally {
      setAssistantEcrit(false);
    }
  }, [fusionner]);

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
      if (data.assistant) void demanderAssistant();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Le message n'a pas pu être envoyé.");
    } finally {
      setEnvoi(false);
    }
  }

  async function appelerLEquipe() {
    // Affiché tout de suite : le bouton disparaît, la bannière apparaît.
    // Un aller-retour serveur avant de réagir donnerait l'impression que
    // le clic n'a rien fait.
    setHumainDemande(true);
    setAssistantActif(false);
    try {
      await fetch("/api/support/thread", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ humanRequested: true }),
      });
    } catch {
      // Le prochain rafraîchissement rétablira l'état réel.
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
            <Accueil prenom={session?.user?.name ?? null} avecAssistant={assistantActif} />
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

          {assistantEcrit && <AssistantRedige />}

          {humainDemande && (
            <p className="flex items-start gap-2 rounded-xl border border-border bg-base px-3.5 py-2.5 text-xs text-ink-muted">
              <UserRound size={13} className="mt-0.5 shrink-0 text-accent" />
              <span>
                L&apos;équipe a été prévenue et vous répondra ici même. Vous recevrez une notification dès que la
                réponse arrive.
              </span>
            </p>
          )}

          {assistantActif && !humainDemande && messages.length > 0 && (
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={appelerLEquipe}
                className="rounded-full border border-border px-3.5 py-2 text-xs text-ink-muted transition-colors hover:border-accent hover:text-ink"
              >
                Parler plutôt à l&apos;équipe
              </button>
            </div>
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

/** Repère `/aide/mon-article` dans un texte brut et en fait un vrai lien. */
const LIEN_AIDE = /(\/aide\/[a-z0-9-]+)/g;

function TexteAvecLiens({ texte }: { texte: string }) {
  // Découpage sur le motif capturant : les segments impairs sont les
  // liens. On construit des éléments React, jamais du HTML — un message
  // reste du texte écrit par quelqu'un d'autre.
  const morceaux = texte.split(LIEN_AIDE);
  return (
    <p className="whitespace-pre-line break-words">
      {morceaux.map((morceau, i) =>
        i % 2 === 1 ? (
          <Link key={i} href={morceau} className="underline underline-offset-2 hover:text-accent">
            {morceau}
          </Link>
        ) : (
          morceau
        )
      )}
    </p>
  );
}

function Bulle({ message }: { message: MessageSupport }) {
  const duMembre = message.author === "user";
  const deLIA = message.author === "ai";
  return (
    <AnimatePresence initial={false}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className={`flex ${duMembre ? "justify-end" : "justify-start"}`}
      >
        <div className={`max-w-[85%] ${duMembre ? "text-right" : ""}`}>
          {!duMembre && (
            <p className="mb-1 flex items-center gap-1.5 text-[11px] text-ink-muted">
              {deLIA ? <Sparkles size={11} className="text-accent" /> : <Headphones size={11} />}
              {deLIA ? "Assistant" : message.authorName || "Support"}
              {/* Dit à chaque bulle, et pas seulement au début de la
                  discussion : quelqu'un qui rouvre le panneau trois jours
                  plus tard doit savoir qui lui a répondu. */}
              {deLIA && (
                <span className="rounded-full border border-accent/40 px-1.5 py-px text-[10px] text-accent">IA</span>
              )}
            </p>
          )}
          <div
            // `bg-base` et non `bg-surface` : le corps de la modale est
            // deja en surface, une bulle de la meme couleur ne se
            // detacherait pas du fond.
            className={`rounded-xl2 px-3.5 py-2.5 text-left text-sm ${
              duMembre ? "bg-accent text-base" : "bg-base text-ink"
            }`}
          >
            <TexteAvecLiens texte={message.body} />
          </div>
          <p className="mt-1 text-[11px] text-ink-muted">{heure(message.createdAt)}</p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function AssistantRedige() {
  return (
    <div className="flex justify-start">
      <p
        // `status` et non `alert` : c'est une attente, pas un incident —
        // un lecteur d'écran ne doit pas interrompre sa lecture pour ça.
        role="status"
        className="flex items-center gap-2 rounded-xl2 bg-base px-3.5 py-2.5 text-sm text-ink-muted"
      >
        <Sparkles size={13} className="animate-pulse text-accent" />
        L&apos;assistant rédige une réponse…
      </p>
    </div>
  );
}

function Accueil({ prenom, avecAssistant }: { prenom: string | null; avecAssistant: boolean }) {
  return (
    <div className="py-8 text-center">
      <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent">
        {avecAssistant ? <Sparkles size={20} /> : <Headphones size={20} />}
      </span>
      <p className="text-sm text-ink">
        {prenom ? `Bonjour ${prenom.split(" ")[0]} !` : "Bonjour !"} Comment pouvons-nous vous aider ?
      </p>
      <p className="mx-auto mt-1.5 max-w-xs text-xs text-ink-muted">
        {avecAssistant ? (
          <>
            Un assistant automatique répond tout de suite à partir du centre d&apos;aide. Vous pouvez demander
            l&apos;équipe à tout moment, et vous recevez une notification dès qu&apos;elle vous répond.
          </>
        ) : (
          <>
            Écrivez ci-dessous : notre équipe vous répond ici même, et vous recevez une notification dès que la
            réponse arrive.
          </>
        )}
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
