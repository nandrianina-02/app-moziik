"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Info, Loader2, MessagesSquare, Users } from "lucide-react";
import { AvatarMembre, AvatarGroupe } from "@/components/messages/AvatarMembre";
import { BulleMessage } from "@/components/messages/BulleMessage";
import { Composeur } from "@/components/messages/Composeur";
import { useToast } from "@/context/ToastProvider";
import { readApiError } from "@/lib/readApiError";
import {
  libelleJour,
  libellePresence,
  type ContenuPartage,
  type ConversationAffichee,
  type MessageAffiche,
} from "@/lib/messagerie";

/**
 * Le fil d'une conversation : entête, messages, saisie.
 *
 * LE RAFRAÎCHISSEMENT NE REDEMANDE QUE CE QUI A BOUGÉ
 *
 * Toutes les quatre secondes, et seulement tant que l'onglet est visible.
 * L'appel porte la date du dernier changement connu ; le serveur renvoie
 * les messages écrits depuis, mais aussi ceux qui ont été modifiés,
 * supprimés ou qui ont reçu une réaction. Sans ce second cas, une
 * réaction posée sur une bulle déjà affichée n'arriverait jamais.
 *
 * LE DÉFILEMENT NE SAUTE PAS
 *
 * On descend en bas à l'ouverture et à chaque message reçu — mais
 * seulement si on y était déjà. Quelqu'un qui remonte l'historique ne
 * doit pas être ramené en bas parce qu'un message vient d'arriver ;
 * c'est le défaut qui rend une messagerie insupportable à relire.
 */

const PERIODE_MS = 4000;
/** Distance au bas du fil en deçà de laquelle on considère qu'on « suit ». */
const SEUIL_BAS = 120;

export function FilDiscussion({
  conversation,
  moiId,
  onRetour,
  onOuvrirReglages,
  onLu,
}: {
  conversation: ConversationAffichee;
  moiId: string;
  /** Mobile : revenir à la liste. Absent sur écran large. */
  onRetour?: () => void;
  onOuvrirReglages: () => void;
  /** Prévient le parent que le fil vient d'être lu, pour la pastille. */
  onLu: (conversationId: string) => void;
}) {
  const pushToast = useToast();
  const [messages, setMessages] = useState<MessageAffiche[]>([]);
  const [chargement, setChargement] = useState(true);
  const [encore, setEncore] = useState(false);
  const [chargePlus, setChargePlus] = useState(false);
  const [reponseA, setReponseA] = useState<MessageAffiche | null>(null);
  const [surligne, setSurligne] = useState<string | null>(null);

  const zone = useRef<HTMLDivElement>(null);
  const suitLeBas = useRef(true);
  const dernierVu = useRef<string | null>(null);
  const conversationId = conversation._id;

  /** Fusionne en respectant l'ordre, et remplace les messages modifiés. */
  const fusionner = useCallback((entrants: MessageAffiche[]) => {
    if (entrants.length === 0) return;
    setMessages((prev) => {
      const parId = new Map(prev.map((m) => [m._id, m]));
      let change = false;
      for (const m of entrants) {
        const ancien = parId.get(m._id);
        if (!ancien || JSON.stringify(ancien) !== JSON.stringify(m)) {
          parId.set(m._id, m);
          change = true;
        }
      }
      if (!change) return prev;
      return [...parId.values()].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
  }, []);

  /** La borne du prochain rafraîchissement : le plus récent des horodatages vus. */
  const noterBorne = useCallback((entrants: MessageAffiche[]) => {
    for (const m of entrants) {
      const t = m.modifieLe && m.modifieLe > m.createdAt ? m.modifieLe : m.createdAt;
      if (!dernierVu.current || t > dernierVu.current) dernierVu.current = t;
    }
  }, []);

  const marquerLu = useCallback(async () => {
    try {
      await fetch(`/api/messagerie/conversations/${conversationId}/lu`, { method: "POST" });
      onLu(conversationId);
    } catch {
      /* la pastille se corrigera au prochain passage */
    }
  }, [conversationId, onLu]);

  // Premier chargement, et rechargement complet au changement de fil.
  useEffect(() => {
    let vivant = true;
    setChargement(true);
    setMessages([]);
    setReponseA(null);
    dernierVu.current = null;
    suitLeBas.current = true;

    (async () => {
      try {
        const res = await fetch(`/api/messagerie/conversations/${conversationId}/messages`);
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { messages: MessageAffiche[]; encore: boolean };
        if (!vivant) return;
        setMessages(data.messages);
        setEncore(data.encore);
        noterBorne(data.messages);
        void marquerLu();
      } catch {
        if (vivant) pushToast("error", "Impossible de charger cette conversation.");
      } finally {
        if (vivant) setChargement(false);
      }
    })();

    return () => {
      vivant = false;
    };
  }, [conversationId, noterBorne, marquerLu, pushToast]);

  // Rafraîchissement périodique, suspendu quand l'onglet est caché : une
  // messagerie ouverte dans un onglet oublié interrogerait le serveur
  // toute la journée pour personne.
  useEffect(() => {
    let arrete = false;
    const battement = setInterval(async () => {
      if (arrete || document.hidden || !dernierVu.current) return;
      try {
        const res = await fetch(
          `/api/messagerie/conversations/${conversationId}/messages?depuis=${encodeURIComponent(dernierVu.current)}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as { messages: MessageAffiche[] };
        if (arrete || data.messages.length === 0) return;
        fusionner(data.messages);
        noterBorne(data.messages);
        // Un message reçu pendant qu'on regarde est lu : ne pas le dire
        // laisserait une pastille sur une conversation ouverte.
        if (data.messages.some((m) => m.auteur?._id !== moiId)) void marquerLu();
      } catch {
        /* le battement suivant réessaiera */
      }
    }, PERIODE_MS);

    return () => {
      arrete = true;
      clearInterval(battement);
    };
  }, [conversationId, fusionner, noterBorne, marquerLu, moiId]);

  // Le défilement est posé avant la peinture : avec useEffect, on voit le
  // fil apparaître en haut puis sauter en bas.
  useLayoutEffect(() => {
    if (!suitLeBas.current) return;
    const el = zone.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function surDefilement() {
    const el = zone.current;
    if (!el) return;
    suitLeBas.current = el.scrollHeight - el.scrollTop - el.clientHeight < SEUIL_BAS;
  }

  async function chargerPlus() {
    const premier = messages[0];
    if (!premier || chargePlus) return;
    setChargePlus(true);
    const el = zone.current;
    const hauteurAvant = el?.scrollHeight ?? 0;
    try {
      const res = await fetch(
        `/api/messagerie/conversations/${conversationId}/messages?avant=${encodeURIComponent(premier.createdAt)}`
      );
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { messages: MessageAffiche[]; encore: boolean };
      suitLeBas.current = false;
      setMessages((prev) => [...data.messages, ...prev]);
      setEncore(data.encore);
      // On recale le défilement sur ce qu'on lisait : sans cela, insérer
      // quarante messages au-dessus renvoie le lecteur ailleurs.
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - hauteurAvant;
      });
    } catch {
      pushToast("error", "Impossible de charger les messages précédents.");
    } finally {
      setChargePlus(false);
    }
  }

  async function envoyer(corps: string, partage: ContenuPartage | null) {
    try {
      const res = await fetch(`/api/messagerie/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          corps,
          ...(partage ? { partage: { type: partage.type, refId: partage.refId } } : {}),
          ...(reponseA ? { repondA: reponseA._id } : {}),
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Le message n'est pas parti."));
      const { message } = (await res.json()) as { message: MessageAffiche };
      suitLeBas.current = true;
      fusionner([message]);
      noterBorne([message]);
      setReponseA(null);
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Le message n'est pas parti.");
      throw err;
    }
  }

  async function basculerReaction(m: MessageAffiche, emoji: string) {
    try {
      const res = await fetch(`/api/messagerie/messages/${m._id}/reaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) throw new Error();
      const { message } = (await res.json()) as { message: MessageAffiche };
      fusionner([message]);
      noterBorne([message]);
    } catch {
      pushToast("error", "La réaction n'a pas pu être enregistrée.");
    }
  }

  async function supprimer(m: MessageAffiche) {
    try {
      const res = await fetch(`/api/messagerie/messages/${m._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      const { message } = (await res.json()) as { message: MessageAffiche };
      fusionner([message]);
      noterBorne([message]);
    } catch {
      pushToast("error", "Le message n'a pas pu être supprimé.");
    }
  }

  async function modifier(m: MessageAffiche, corps: string) {
    const res = await fetch(`/api/messagerie/messages/${m._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ corps }),
    });
    if (!res.ok) {
      pushToast("error", await readApiError(res, "La modification a échoué."));
      return;
    }
    const { message } = (await res.json()) as { message: MessageAffiche };
    fusionner([message]);
    noterBorne([message]);
  }

  function allerA(messageId: string) {
    const cible = document.getElementById(`message-${messageId}`);
    if (!cible) {
      pushToast("info", "Ce message n'est pas encore chargé — remontez la conversation.");
      return;
    }
    cible.scrollIntoView({ behavior: "smooth", block: "center" });
    setSurligne(messageId);
    setTimeout(() => setSurligne(null), 1600);
  }

  const sousTitre =
    conversation.type === "group"
      ? `${conversation.participants.length} participants`
      : libellePresence(conversation.interlocuteur?.vuLe);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-border px-3 py-3 sm:px-4">
        {onRetour && (
          <button
            type="button"
            onClick={onRetour}
            className="-ml-1 rounded-full p-1.5 text-ink-muted transition-colors hover:bg-base lg:hidden"
            aria-label="Retour aux conversations"
          >
            <ArrowLeft size={19} />
          </button>
        )}

        {conversation.type === "group" ? (
          <AvatarGroupe nom={conversation.titre} imageUrl={conversation.imageUrl} taille={40} />
        ) : (
          <AvatarMembre
            nom={conversation.titre}
            avatarUrl={conversation.imageUrl}
            vuLe={conversation.interlocuteur?.vuLe}
            taille={40}
          />
        )}

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[15px] font-semibold">
            {conversation.type === "group" && <Users size={13} className="shrink-0 text-ink-muted" />}
            {conversation.titre}
          </p>
          <p className="truncate text-xs text-ink-muted">{sousTitre}</p>
        </div>

        <button
          type="button"
          onClick={onOuvrirReglages}
          className="rounded-full p-2 text-ink-muted transition-colors hover:bg-base hover:text-accent"
          aria-label="Informations et réglages"
        >
          <Info size={18} />
        </button>
      </header>

      <div
        ref={zone}
        onScroll={surDefilement}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4"
      >
        {chargement ? (
          <div className="flex h-full items-center justify-center text-ink-muted">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-ink-muted">
            <MessagesSquare size={30} className="opacity-50" />
            <p className="max-w-xs text-sm">
              Aucun message. Écrivez le premier, ou partagez un titre pour lancer la discussion.
            </p>
          </div>
        ) : (
          <>
            {encore && (
              <div className="mb-3 flex justify-center">
                <button
                  type="button"
                  onClick={chargerPlus}
                  disabled={chargePlus}
                  className="flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
                >
                  {chargePlus && <Loader2 size={12} className="animate-spin" />}
                  Messages précédents
                </button>
              </div>
            )}

            {messages.map((m, i) => {
              const precedent = messages[i - 1];
              const nouveauJour =
                !precedent || libelleJour(precedent.createdAt) !== libelleJour(m.createdAt);
              const memeAuteur =
                precedent &&
                !nouveauJour &&
                precedent.auteur?._id === m.auteur?._id &&
                new Date(m.createdAt).getTime() - new Date(precedent.createdAt).getTime() < 5 * 60 * 1000;

              return (
                <div key={m._id}>
                  {nouveauJour && (
                    <div className="my-4 flex items-center gap-3">
                      <span className="h-px flex-1 bg-border" />
                      <span className="text-[11px] font-medium text-ink-muted">
                        {libelleJour(m.createdAt)}
                      </span>
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  <BulleMessage
                    message={m}
                    aMoi={m.auteur?._id === moiId}
                    moiId={moiId}
                    afficherAuteur={!memeAuteur}
                    surRepondre={setReponseA}
                    surReaction={basculerReaction}
                    surSupprimer={supprimer}
                    surModifier={modifier}
                    surAllerA={allerA}
                    surligne={surligne === m._id}
                  />
                </div>
              );
            })}
          </>
        )}
      </div>

      <Composeur
        onEnvoyer={envoyer}
        reponseA={reponseA}
        onAnnulerReponse={() => setReponseA(null)}
        placeholder={
          conversation.type === "group"
            ? `Écrire dans ${conversation.titre}…`
            : `Écrire à ${conversation.titre}…`
        }
      />
    </div>
  );
}
