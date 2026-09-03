"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CornerUpLeft, SmilePlus, Trash2, Pencil, Check, X } from "lucide-react";
import { AvatarMembre } from "@/components/messages/AvatarMembre";
import { CartePartage } from "@/components/messages/CartePartage";
import { heureCourte, REACTIONS_RAPIDES, type MessageAffiche } from "@/lib/messagerie";

/**
 * Une bulle, et tout ce qu'on peut en faire.
 *
 * LES ACTIONS NE SE CACHENT PAS DERRIÈRE UN SURVOL
 *
 * Ce projet a déjà tranché la question : sur un téléphone il n'y a pas de
 * survol, et une action qui n'apparaît qu'au passage de la souris
 * n'existe pas pour la moitié des gens. La rangée d'actions est donc
 * toujours dans le flux, discrète, et grandit au survol sans jamais
 * apparaître seulement à ce moment-là.
 *
 * LA CITATION EST CLIQUABLE
 *
 * Répondre sans pouvoir remonter au message cité oblige à faire défiler
 * la conversation à l'aveugle. Le bandeau de citation ramène donc à la
 * bulle d'origine et la fait clignoter.
 */
export function BulleMessage({
  message,
  aMoi,
  moiId,
  afficherAuteur,
  surRepondre,
  surReaction,
  surSupprimer,
  surModifier,
  surAllerA,
  surligne,
}: {
  message: MessageAffiche;
  aMoi: boolean;
  moiId: string;
  /** Faux quand le message suit un autre du même auteur : on ne répète ni l'avatar ni le nom. */
  afficherAuteur: boolean;
  surRepondre: (m: MessageAffiche) => void;
  surReaction: (m: MessageAffiche, emoji: string) => void;
  surSupprimer: (m: MessageAffiche) => void;
  surModifier: (m: MessageAffiche, corps: string) => Promise<void>;
  surAllerA: (messageId: string) => void;
  surligne: boolean;
}) {
  const [paletteOuverte, setPaletteOuverte] = useState(false);
  const [edition, setEdition] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const bulle = aMoi
    ? "bg-accent text-white rounded-br-md"
    : "bg-surface text-ink rounded-bl-md border border-border";

  async function validerEdition() {
    if (edition === null) return;
    const propre = edition.trim();
    if (!propre || propre === message.corps) {
      setEdition(null);
      return;
    }
    setEnvoi(true);
    try {
      await surModifier(message, propre);
      setEdition(null);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <motion.div
      id={`message-${message._id}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`flex gap-2 ${aMoi ? "flex-row-reverse" : "flex-row"} ${afficherAuteur ? "mt-3" : "mt-0.5"}`}
    >
      {/* La gouttière est réservée même sans avatar : sans elle, les
          messages consécutifs d'un même auteur se décaleraient. */}
      <div className="w-8 shrink-0">
        {!aMoi && afficherAuteur && (
          <AvatarMembre
            nom={message.auteur?.name ?? "?"}
            avatarUrl={message.auteur?.avatarUrl}
            taille={32}
            presence={false}
          />
        )}
      </div>

      <div className={`flex min-w-0 max-w-[min(560px,78%)] flex-col ${aMoi ? "items-end" : "items-start"}`}>
        {!aMoi && afficherAuteur && (
          <p className="mb-0.5 px-1 text-xs font-medium text-ink-muted">{message.auteur?.name}</p>
        )}

        <div
          className={`relative rounded-2xl px-3.5 py-2.5 transition-shadow ${bulle} ${
            surligne ? "ring-2 ring-accent ring-offset-2 ring-offset-base" : ""
          }`}
        >
          {message.citation && (
            <button
              type="button"
              onClick={() => surAllerA(message.citation!.messageId)}
              className={`mb-2 flex w-full flex-col items-start gap-0.5 rounded-lg border-l-2 px-2 py-1 text-left transition-colors ${
                aMoi
                  ? "border-white/60 bg-white/10 hover:bg-white/15"
                  : "border-accent bg-base hover:bg-base/70"
              }`}
            >
              <span className={`text-[11px] font-semibold ${aMoi ? "text-white/90" : "text-accent"}`}>
                {message.citation.auteurNom}
              </span>
              <span className={`line-clamp-2 text-xs ${aMoi ? "text-white/70" : "text-ink-muted"}`}>
                {message.citation.extrait || "Message supprimé"}
              </span>
            </button>
          )}

          {message.supprime ? (
            <p className={`text-sm italic ${aMoi ? "text-white/60" : "text-ink-muted"}`}>
              Message supprimé
            </p>
          ) : edition !== null ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={edition}
                onChange={(e) => setEdition(e.target.value)}
                rows={2}
                autoFocus
                className={`w-full resize-none rounded-lg px-2 py-1.5 text-sm outline-none ${
                  aMoi ? "bg-white/15 text-white placeholder:text-white/50" : "bg-base text-ink"
                }`}
              />
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  onClick={() => setEdition(null)}
                  className={`rounded-full p-1.5 ${aMoi ? "hover:bg-white/15" : "hover:bg-base"}`}
                  aria-label="Annuler la modification"
                >
                  <X size={14} />
                </button>
                <button
                  type="button"
                  onClick={validerEdition}
                  disabled={envoi}
                  className={`rounded-full p-1.5 disabled:opacity-60 ${
                    aMoi ? "hover:bg-white/15" : "hover:bg-base"
                  }`}
                  aria-label="Enregistrer la modification"
                >
                  <Check size={14} />
                </button>
              </div>
            </div>
          ) : (
            <>
              {message.corps && (
                // selectionnable : la sélection est désactivée globalement
                // sur mobile, mais on doit pouvoir copier un message.
                <p className="selectionnable whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {message.corps}
                </p>
              )}
              {message.partage && <CartePartage partage={message.partage} aMoi={aMoi} />}
            </>
          )}

          <p
            className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
              aMoi ? "text-white/60" : "text-ink-muted"
            }`}
          >
            {message.modifieLe && !message.supprime && <span>modifié</span>}
            {heureCourte(message.createdAt)}
          </p>
        </div>

        {message.reactions.length > 0 && (
          <div className={`-mt-1.5 flex flex-wrap gap-1 ${aMoi ? "justify-end" : "justify-start"}`}>
            {message.reactions.map((r) => {
              const jySuis = r.users.includes(moiId);
              return (
                <button
                  key={r.emoji}
                  type="button"
                  onClick={() => surReaction(message, r.emoji)}
                  className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition-colors ${
                    jySuis
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-border bg-surface text-ink-muted hover:border-accent/40"
                  }`}
                  title={jySuis ? "Retirer ma réaction" : "Réagir"}
                >
                  <span>{r.emoji}</span>
                  <span className="tabular-nums">{r.users.length}</span>
                </button>
              );
            })}
          </div>
        )}

        {!message.supprime && (
          <div
            className={`mt-0.5 flex items-center gap-0.5 text-ink-muted ${
              aMoi ? "flex-row-reverse" : "flex-row"
            }`}
          >
            <button
              type="button"
              onClick={() => setPaletteOuverte((v) => !v)}
              className="rounded-full p-1 opacity-60 transition hover:bg-surface hover:opacity-100"
              aria-label="Réagir à ce message"
              aria-expanded={paletteOuverte}
            >
              <SmilePlus size={14} />
            </button>
            <button
              type="button"
              onClick={() => surRepondre(message)}
              className="rounded-full p-1 opacity-60 transition hover:bg-surface hover:opacity-100"
              aria-label="Répondre à ce message"
            >
              <CornerUpLeft size={14} />
            </button>
            {aMoi && (
              <>
                {message.corps && (
                  <button
                    type="button"
                    onClick={() => setEdition(message.corps)}
                    className="rounded-full p-1 opacity-60 transition hover:bg-surface hover:opacity-100"
                    aria-label="Modifier ce message"
                  >
                    <Pencil size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => surSupprimer(message)}
                  className="rounded-full p-1 opacity-60 transition hover:bg-surface hover:text-danger hover:opacity-100"
                  aria-label="Supprimer ce message"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}

            {paletteOuverte && (
              <div className="flex items-center gap-0.5 rounded-full border border-border bg-surface px-1.5 py-1 shadow-lg">
                {REACTIONS_RAPIDES.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      surReaction(message, emoji);
                      setPaletteOuverte(false);
                    }}
                    // text-[15px] et non text-base : dans ce projet
                    // `text-base` est une COULEUR, pas une taille.
                    className="rounded-full px-1 text-[15px] leading-none transition-transform hover:scale-125"
                    aria-label={`Réagir avec ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
