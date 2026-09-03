"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Send, X, Loader2, CornerUpLeft } from "lucide-react";
import { SelecteurContenu } from "@/components/messages/SelecteurContenu";
import {
  CORPS_MAX,
  ICONES_PARTAGE,
  LIBELLES_PARTAGE,
  type ContenuPartage,
  type MessageAffiche,
} from "@/lib/messagerie";

/**
 * La zone de saisie : texte, contenu joint, réponse en cours.
 *
 * ENTRÉE ENVOIE, MAJ+ENTRÉE VA À LA LIGNE
 *
 * C'est la convention de toutes les messageries, et la contredire coûte
 * un message envoyé de travers à chaque essai. Sur écran tactile, où il
 * n'y a pas de touche Entrée dédiée, seul le bouton envoie.
 *
 * LE CHAMP GRANDIT AVEC LE TEXTE
 *
 * Jusqu'à cinq lignes, puis il défile. Un champ d'une ligne oblige à
 * écrire à l'aveugle dès qu'on dépasse une phrase ; un champ qui grandit
 * sans fin finit par manger la conversation qu'on est en train de lire.
 */

const LIGNES_MAX = 5;

export function Composeur({
  onEnvoyer,
  reponseA,
  onAnnulerReponse,
  desactive,
  placeholder = "Écrivez un message…",
}: {
  onEnvoyer: (corps: string, partage: ContenuPartage | null) => Promise<void>;
  reponseA: MessageAffiche | null;
  onAnnulerReponse: () => void;
  desactive?: boolean;
  placeholder?: string;
}) {
  const [texte, setTexte] = useState("");
  const [partage, setPartage] = useState<ContenuPartage | null>(null);
  const [selecteur, setSelecteur] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const champ = useRef<HTMLTextAreaElement>(null);

  // Hauteur recalculée à chaque frappe : remise à zéro d'abord, sinon le
  // champ ne rétrécit jamais quand on efface.
  useEffect(() => {
    const el = champ.current;
    if (!el) return;
    el.style.height = "auto";
    const ligne = 22;
    el.style.height = `${Math.min(el.scrollHeight, ligne * LIGNES_MAX + 20)}px`;
  }, [texte]);

  useEffect(() => {
    if (reponseA) champ.current?.focus();
  }, [reponseA]);

  const peutEnvoyer = (texte.trim().length > 0 || partage !== null) && !envoi && !desactive;

  async function envoyer() {
    if (!peutEnvoyer) return;
    setEnvoi(true);
    try {
      await onEnvoyer(texte.trim(), partage);
      setTexte("");
      setPartage(null);
    } finally {
      setEnvoi(false);
    }
  }

  const IconePartage = partage ? ICONES_PARTAGE[partage.type] : null;

  return (
    <div className="border-t border-border bg-surface px-3 py-2.5 sm:px-4">
      {reponseA && (
        <div className="mb-2 flex items-start gap-2 rounded-xl border-l-2 border-accent bg-base px-3 py-2">
          <CornerUpLeft size={14} className="mt-0.5 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-accent">
              Réponse à {reponseA.auteur?.name ?? "un message"}
            </p>
            <p className="truncate text-xs text-ink-muted">
              {reponseA.corps || (reponseA.partage ? reponseA.partage.titre : "Message supprimé")}
            </p>
          </div>
          <button
            type="button"
            onClick={onAnnulerReponse}
            className="rounded-full p-1 text-ink-muted transition-colors hover:bg-surface"
            aria-label="Annuler la réponse"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {partage && IconePartage && (
        <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-border bg-base px-3 py-2">
          <IconePartage size={16} className="shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
              {LIBELLES_PARTAGE[partage.type]}
            </p>
            <p className="truncate text-sm font-medium">{partage.titre}</p>
          </div>
          <button
            type="button"
            onClick={() => setPartage(null)}
            className="rounded-full p-1 text-ink-muted transition-colors hover:bg-surface"
            aria-label="Retirer le contenu joint"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => setSelecteur(true)}
          disabled={desactive}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          aria-label="Joindre un contenu"
        >
          <Plus size={18} />
        </button>

        <textarea
          ref={champ}
          value={texte}
          onChange={(e) => setTexte(e.target.value.slice(0, CORPS_MAX))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void envoyer();
            }
          }}
          rows={1}
          disabled={desactive}
          placeholder={placeholder}
          className="selectionnable max-h-32 min-h-[40px] flex-1 resize-none rounded-2xl border border-border bg-base px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-ink-muted focus:border-accent disabled:opacity-60"
        />

        <button
          type="button"
          onClick={envoyer}
          disabled={!peutEnvoyer}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-base transition-colors hover:bg-accent-hover disabled:opacity-40"
          aria-label="Envoyer"
        >
          {envoi ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
        </button>
      </div>

      {selecteur && (
        <SelecteurContenu
          onChoisir={(contenu) => {
            setPartage(contenu);
            setSelecteur(false);
          }}
          onClose={() => setSelecteur(false)}
        />
      )}
    </div>
  );
}
