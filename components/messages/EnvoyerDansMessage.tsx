"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, MessagesSquare, Search, Send, Users } from "lucide-react";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { AvatarMembre, AvatarGroupe } from "@/components/messages/AvatarMembre";
import { useToast } from "@/context/ToastProvider";
import { readApiError } from "@/lib/readApiError";
import {
  ICONES_PARTAGE,
  LIBELLES_PARTAGE,
  type ConversationAffichee,
  type TypePartage,
} from "@/lib/messagerie";

type Personne = { _id: string; name: string; username?: string; avatarUrl?: string; vuLe?: string | null };

/**
 * Envoyer un contenu à quelqu'un, depuis la fenêtre de partage.
 *
 * POURQUOI CE CHEMIN EXISTE À CÔTÉ DES RÉSEAUX SOCIAUX
 *
 * Partager un titre à un ami passait jusqu'ici par un lien copié dans une
 * application tierce. Le lien fonctionne, mais il sort de Moziik : l'ami
 * reçoit une URL, pas une carte, et la conversation se poursuit ailleurs.
 * Ici le contenu arrive comme une carte jouable, dans un fil qui reste.
 *
 * ON PEUT VISER PLUSIEURS FILS D'UN COUP
 *
 * Envoyer le même morceau à trois personnes est le cas courant, et
 * rouvrir la fenêtre trois fois pour cela serait absurde. Chaque envoi
 * est une requête distincte : si l'une échoue, les autres sont parties, et
 * le message le dit.
 */
export function EnvoyerDansMessage({
  type,
  refId,
  titre,
  onClose,
}: {
  type: TypePartage;
  refId: string;
  titre: string;
  onClose: () => void;
}) {
  const pushToast = useToast();
  const [conversations, setConversations] = useState<ConversationAffichee[]>([]);
  const [personnes, setPersonnes] = useState<Personne[]>([]);
  const [filtre, setFiltre] = useState("");
  const [cibles, setCibles] = useState<string[]>([]);
  const [contacts, setContacts] = useState<string[]>([]);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);

  const Icone = ICONES_PARTAGE[type];

  useEffect(() => {
    (async () => {
      try {
        const [resFils, resGens] = await Promise.all([
          fetch("/api/messagerie/conversations"),
          fetch("/api/messagerie/destinataires"),
        ]);
        if (resFils.ok) {
          const data = (await resFils.json()) as { conversations: ConversationAffichee[] };
          setConversations(data.conversations);
        }
        if (resGens.ok) {
          const data = (await resGens.json()) as { personnes: Personne[] };
          setPersonnes(data.personnes);
        }
      } finally {
        setChargement(false);
      }
    })();
  }, []);

  // Une personne avec qui on a déjà un fil n'apparaît qu'une fois : la
  // conversation existante est la même destination que « écrire à ».
  const dejaEnFil = new Set(
    conversations.filter((c) => c.type === "direct").map((c) => c.interlocuteur?._id ?? "")
  );

  const q = filtre.trim().toLowerCase();
  const filsVisibles = conversations.filter((c) => !q || c.titre.toLowerCase().includes(q));
  const gensVisibles = personnes.filter(
    (p) => !dejaEnFil.has(p._id) && (!q || p.name.toLowerCase().includes(q))
  );

  const total = cibles.length + contacts.length;

  async function envoyer() {
    if (total === 0) return;
    setEnvoi(true);
    let echecs = 0;

    // Les nouveaux fils d'abord : la route de création est idempotente
    // (index unique sur la paire), donc réutiliser un fil existant ne
    // crée pas de doublon.
    const destinations = [...cibles];
    for (const userId of contacts) {
      try {
        const res = await fetch("/api/messagerie/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "direct", destinataire: userId }),
        });
        if (!res.ok) throw new Error();
        const { conversation } = (await res.json()) as { conversation: ConversationAffichee };
        destinations.push(conversation._id);
      } catch {
        echecs += 1;
      }
    }

    for (const conversationId of destinations) {
      try {
        const res = await fetch(`/api/messagerie/conversations/${conversationId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ corps: "", partage: { type, refId } }),
        });
        if (!res.ok) throw new Error(await readApiError(res, "Envoi impossible."));
      } catch {
        echecs += 1;
      }
    }

    setEnvoi(false);
    if (echecs === 0) {
      setEnvoye(true);
      pushToast("success", total > 1 ? `Envoyé à ${total} conversations.` : "Envoyé.");
      setTimeout(onClose, 700);
    } else {
      pushToast("error", `${echecs} envoi(s) ont échoué.`);
    }
  }

  return (
    <ModalSheet
      titre="Envoyer dans un message"
      sousTitre={`${LIBELLES_PARTAGE[type]} · ${titre}`}
      onClose={onClose}
      entete={
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            value={filtre}
            onChange={(e) => setFiltre(e.target.value)}
            placeholder="Une conversation, une personne…"
            className="w-full rounded-full border border-border bg-base py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-accent"
          />
        </div>
      }
      pied={
        <button
          type="button"
          onClick={envoyer}
          disabled={total === 0 || envoi || envoye}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-2.5 text-sm font-semibold text-base transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {envoi ? (
            <Loader2 size={15} className="animate-spin" />
          ) : envoye ? (
            <Check size={15} />
          ) : (
            <Send size={15} />
          )}
          {envoye ? "Envoyé" : total > 0 ? `Envoyer (${total})` : "Envoyer"}
        </button>
      }
    >
      {chargement ? (
        <div className="flex justify-center py-10 text-ink-muted">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : filsVisibles.length === 0 && gensVisibles.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-ink-muted">
          <MessagesSquare size={26} className="opacity-50" />
          <p className="text-sm">
            {q ? "Rien ne correspond." : "Aucune conversation pour l'instant."}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-base px-3 py-2.5">
            <Icone size={16} className="shrink-0 text-accent" />
            <p className="min-w-0 flex-1 truncate text-sm">
              <span className="font-medium">{titre}</span>
              <span className="text-ink-muted"> partira comme carte jouable.</span>
            </p>
          </div>

          {filsVisibles.length > 0 && (
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                Conversations
              </h3>
              <ul className="space-y-1">
                {filsVisibles.map((c) => (
                  <Ligne
                    key={c._id}
                    coche={cibles.includes(c._id)}
                    onToggle={() =>
                      setCibles((p) => (p.includes(c._id) ? p.filter((x) => x !== c._id) : [...p, c._id]))
                    }
                    avatar={
                      c.type === "group" ? (
                        <AvatarGroupe nom={c.titre} imageUrl={c.imageUrl} taille={38} />
                      ) : (
                        <AvatarMembre
                          nom={c.titre}
                          avatarUrl={c.imageUrl}
                          vuLe={c.interlocuteur?.vuLe}
                          taille={38}
                        />
                      )
                    }
                    titre={c.titre}
                    detail={c.type === "group" ? `${c.participants.length} participants` : undefined}
                    icone={c.type === "group" ? <Users size={11} /> : null}
                  />
                ))}
              </ul>
            </section>
          )}

          {gensVisibles.length > 0 && (
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                Écrire à
              </h3>
              <ul className="space-y-1">
                {gensVisibles.map((p) => (
                  <Ligne
                    key={p._id}
                    coche={contacts.includes(p._id)}
                    onToggle={() =>
                      setContacts((prev) =>
                        prev.includes(p._id) ? prev.filter((x) => x !== p._id) : [...prev, p._id]
                      )
                    }
                    avatar={<AvatarMembre nom={p.name} avatarUrl={p.avatarUrl} vuLe={p.vuLe} taille={38} />}
                    titre={p.name}
                    detail={p.username ? `@${p.username}` : undefined}
                    icone={null}
                  />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </ModalSheet>
  );
}

function Ligne({
  coche,
  onToggle,
  avatar,
  titre,
  detail,
  icone,
}: {
  coche: boolean;
  onToggle: () => void;
  avatar: React.ReactNode;
  titre: string;
  detail?: string;
  icone: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors ${
          coche ? "bg-accent/10" : "hover:bg-base"
        }`}
      >
        {avatar}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 truncate text-sm font-medium">
            {icone}
            {titre}
          </span>
          {detail && <span className="block truncate text-xs text-ink-muted">{detail}</span>}
        </span>
        <span
          aria-hidden
          className={`h-4 w-4 shrink-0 rounded-md border-2 transition-colors ${
            coche ? "border-accent bg-accent" : "border-border"
          }`}
        />
      </button>
    </li>
  );
}
