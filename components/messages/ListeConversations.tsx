"use client";

import { useMemo, useState } from "react";
import { Search, PenSquare, BellOff, Users } from "lucide-react";
import { AvatarMembre, AvatarGroupe } from "@/components/messages/AvatarMembre";
import { horodatageListe, type ConversationAffichee } from "@/lib/messagerie";

/**
 * La colonne de gauche : mes conversations.
 *
 * LE FILTRE EST LOCAL, ET C'EST SUFFISANT
 *
 * La liste tient déjà en mémoire — cinquante fils au plus. Interroger le
 * serveur à chaque lettre ajouterait une latence et un état de
 * chargement pour filtrer ce qu'on a déjà sous la main.
 *
 * Ce que le filtre ne fait pas : chercher dans le contenu des messages.
 * Une barre qui promettrait cela et ne fouillerait que les titres serait
 * pire que pas de barre du tout — le champ annonce donc « une
 * conversation », pas « un message ».
 */
export function ListeConversations({
  conversations,
  actifId,
  onSelection,
  onNouvelle,
  chargement,
}: {
  conversations: ConversationAffichee[];
  actifId: string | null;
  onSelection: (id: string) => void;
  onNouvelle: () => void;
  chargement: boolean;
}) {
  const [filtre, setFiltre] = useState("");

  const visibles = useMemo(() => {
    const q = filtre.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.titre.toLowerCase().includes(q));
  }, [conversations, filtre]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
        <h1 className="text-lg font-semibold">Conversations</h1>
        <button
          type="button"
          onClick={onNouvelle}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-ink-muted transition-colors hover:border-accent hover:text-accent"
          aria-label="Nouvelle conversation"
          title="Nouvelle conversation"
        >
          <PenSquare size={17} />
        </button>
      </div>

      <div className="px-4 pb-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            value={filtre}
            onChange={(e) => setFiltre(e.target.value)}
            placeholder="Rechercher une conversation…"
            className="w-full rounded-full border border-border bg-base py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-accent"
          />
        </div>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {chargement && conversations.length === 0 && (
          <li className="space-y-3 px-4 py-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex animate-pulse items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-border" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/2 rounded bg-border" />
                  <div className="h-2.5 w-3/4 rounded bg-border" />
                </div>
              </div>
            ))}
          </li>
        )}

        {!chargement && visibles.length === 0 && (
          <li className="px-6 py-12 text-center text-sm text-ink-muted">
            {filtre ? (
              <>Aucune conversation ne porte ce nom.</>
            ) : (
              <>
                Aucune conversation pour l&apos;instant.
                <button
                  type="button"
                  onClick={onNouvelle}
                  className="mt-3 block w-full rounded-full bg-accent px-4 py-2 text-sm font-semibold text-base transition-colors hover:bg-accent-hover"
                >
                  Écrire à quelqu&apos;un
                </button>
              </>
            )}
          </li>
        )}

        {visibles.map((c) => {
          const actif = c._id === actifId;
          return (
            <li key={c._id}>
              <button
                type="button"
                onClick={() => onSelection(c._id)}
                aria-current={actif}
                className={`flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left transition-colors ${
                  actif
                    ? "border-accent bg-base"
                    : "border-transparent hover:bg-base"
                }`}
              >
                {c.type === "group" ? (
                  <AvatarGroupe nom={c.titre} imageUrl={c.imageUrl} />
                ) : (
                  <AvatarMembre
                    nom={c.titre}
                    avatarUrl={c.imageUrl}
                    vuLe={c.interlocuteur?.vuLe}
                  />
                )}

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    {c.type === "group" && <Users size={12} className="shrink-0 text-ink-muted" />}
                    <span
                      className={`truncate text-sm ${c.nonLus > 0 ? "font-semibold text-ink" : "font-medium"}`}
                    >
                      {c.titre}
                    </span>
                    {c.silencieux && <BellOff size={11} className="shrink-0 text-ink-muted" />}
                  </span>
                  <span
                    className={`mt-0.5 block truncate text-xs ${
                      c.nonLus > 0 ? "font-medium text-ink" : "text-ink-muted"
                    }`}
                  >
                    {c.apercu || "Aucun message"}
                  </span>
                </span>

                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="text-[11px] text-ink-muted">
                    {horodatageListe(c.dernierMessageLe)}
                  </span>
                  {c.nonLus > 0 && (
                    <span className="min-w-[20px] rounded-full bg-accent px-1.5 py-0.5 text-center text-[10px] font-bold leading-4 text-base">
                      {c.nonLus > 99 ? "99+" : c.nonLus}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
