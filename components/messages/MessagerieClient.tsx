"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { LogIn, MessagesSquare, Loader2 } from "lucide-react";
import { ListeConversations } from "@/components/messages/ListeConversations";
import { FilDiscussion } from "@/components/messages/FilDiscussion";
import { NouvelleConversation } from "@/components/messages/NouvelleConversation";
import { ReglagesGroupe } from "@/components/messages/ReglagesGroupe";
import { useToast } from "@/context/ToastProvider";
import type { ConversationAffichee } from "@/lib/messagerie";

/**
 * La messagerie.
 *
 * DEUX PANNEAUX SUR GRAND ÉCRAN, UN SEUL SUR TÉLÉPHONE
 *
 * Le même composant sert les deux : c'est l'affichage qui change, pas la
 * navigation. Sur téléphone, la liste laisse la place au fil quand on en
 * ouvre un, et le bouton retour ramène à la liste — deux routes distinctes
 * auraient rechargé la liste à chaque aller-retour.
 *
 * LA CONVERSATION OUVERTE EST DANS L'URL
 *
 * `?c=<id>`, pour qu'une notification puisse ouvrir directement le bon fil
 * et qu'un rafraîchissement de page ne renvoie pas à l'écran d'accueil.
 *
 * LA LISTE SE RAFRAÎCHIT AUSSI
 *
 * Plus lentement que le fil ouvert : ce qu'on y guette est l'arrivée d'un
 * message dans une conversation qu'on ne regarde pas, ce qui ne demande
 * pas la même réactivité que la conversation sous les yeux.
 */

const PERIODE_LISTE_MS = 12000;

export function MessagerieClient() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const pushToast = useToast();

  const [conversations, setConversations] = useState<ConversationAffichee[]>([]);
  const [chargement, setChargement] = useState(true);
  const [nouvelle, setNouvelle] = useState(false);
  const [reglages, setReglages] = useState(false);

  const moiId = session?.user?.id ?? "";
  const actifId = params.get("c");
  const active = conversations.find((c) => c._id === actifId) ?? null;

  const charger = useCallback(async () => {
    try {
      const res = await fetch("/api/messagerie/conversations");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { conversations: ConversationAffichee[] };
      setConversations(data.conversations);
    } catch {
      pushToast("error", "Impossible de charger vos conversations.");
    } finally {
      setChargement(false);
    }
  }, [pushToast]);

  useEffect(() => {
    if (status !== "authenticated") return;
    void charger();
  }, [status, charger]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const battement = setInterval(() => {
      if (!document.hidden) void charger();
    }, PERIODE_LISTE_MS);
    return () => clearInterval(battement);
  }, [status, charger]);

  function ouvrir(id: string) {
    router.replace(`/messages?c=${id}`, { scroll: false });
  }

  /**
   * Ouvre le fil de l'assistant.
   *
   * Il n'est créé qu'ici, au premier usage : le créer d'office pour
   * chaque compte remplirait la base de conversations vides, et
   * poserait une écriture sur une simple visite de la page.
   */
  async function ouvrirAssistant() {
    try {
      const res = await fetch("/api/messagerie/assistant");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { conversation: ConversationAffichee; disponible: boolean };
      remplacer(data.conversation);
      ouvrir(data.conversation._id);
      if (!data.disponible) {
        pushToast("info", "L'assistant est momentanément indisponible.");
      }
    } catch {
      pushToast("error", "Impossible d'ouvrir l'assistant.");
    }
  }

  /** Remet à zéro la pastille sans attendre le prochain chargement. */
  const marquerLu = useCallback((id: string) => {
    setConversations((prev) => prev.map((c) => (c._id === id ? { ...c, nonLus: 0 } : c)));
  }, []);

  function remplacer(frais: ConversationAffichee) {
    setConversations((prev) => {
      const connue = prev.some((c) => c._id === frais._id);
      return connue ? prev.map((c) => (c._id === frais._id ? frais : c)) : [frais, ...prev];
    });
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-ink-muted">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <MessagesSquare size={34} className="text-ink-muted" />
        <h1 className="text-lg font-semibold">Vos messages</h1>
        <p className="text-sm text-ink-muted">
          La messagerie demande un compte : c&apos;est ce qui permet de vous retrouver vos
          conversations d&apos;un appareil à l&apos;autre.
        </p>
        <Link
          href="/connexion"
          className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-base transition-colors hover:bg-accent-hover"
        >
          <LogIn size={16} /> Se connecter
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto h-[calc(100dvh-8rem)] max-w-7xl px-0 sm:px-4 md:h-[calc(100dvh-4rem)] md:py-4">
      <div className="flex h-full min-h-0 overflow-hidden border-border bg-surface sm:rounded-xl2 sm:border">
        {/* Sur téléphone, un seul panneau à la fois : la liste s'efface
            quand un fil est ouvert, et revient au retour. */}
        <aside
          className={`w-full min-w-0 shrink-0 border-border lg:w-[340px] lg:border-r ${
            actifId ? "hidden lg:block" : "block"
          }`}
        >
          <ListeConversations
            conversations={conversations}
            actifId={actifId}
            onSelection={ouvrir}
            onNouvelle={() => setNouvelle(true)}
            onAssistant={ouvrirAssistant}
            chargement={chargement}
          />
        </aside>

        <section className={`min-w-0 flex-1 ${actifId ? "block" : "hidden lg:block"}`}>
          {active ? (
            <FilDiscussion
              key={active._id}
              conversation={active}
              moiId={moiId}
              onRetour={() => router.replace("/messages", { scroll: false })}
              onOuvrirReglages={() => setReglages(true)}
              onLu={marquerLu}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-ink-muted">
              <MessagesSquare size={34} className="opacity-40" />
              <p className="max-w-xs text-sm">
                Choisissez une conversation, ou écrivez à quelqu&apos;un pour lui envoyer un
                titre, un album ou un évènement.
              </p>
              <button
                type="button"
                onClick={() => setNouvelle(true)}
                className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-base transition-colors hover:bg-accent-hover"
              >
                Nouvelle conversation
              </button>
            </div>
          )}
        </section>
      </div>

      {nouvelle && (
        <NouvelleConversation
          onCree={(c) => {
            remplacer(c);
            setNouvelle(false);
            ouvrir(c._id);
          }}
          onClose={() => setNouvelle(false)}
        />
      )}

      {/* L'assistant n'a ni participants, ni nom à changer, ni sortie. */}
      {reglages && active && active.type !== "assistant" && (
        <ReglagesGroupe
          conversation={active}
          moiId={moiId}
          onMaj={remplacer}
          onQuitte={() => {
            setConversations((prev) => prev.filter((c) => c._id !== active._id));
            setReglages(false);
            router.replace("/messages", { scroll: false });
            pushToast("success", "Vous avez quitté le groupe.");
          }}
          onClose={() => setReglages(false)}
        />
      )}
    </div>
  );
}
