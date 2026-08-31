"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Déroulé progressif d'une liste : la page s'ouvre sur un aperçu, « Voir
 * plus » révèle un palier de plus. Tout est déjà en mémoire — il ne s'agit
 * pas de pagination réseau, mais de ne pas dérouler cent lignes devant
 * quelqu'un qui en cherchait cinq, et de laisser atteindre au doigt ce qui
 * suit la liste.
 *
 * `resetKey` replie l'aperçu quand ce qu'on regarde change (onglet, filtre,
 * tri, autre disque) : sans lui, un déroulé resterait ouvert sur un contenu
 * qui n'a plus rien à voir avec celui qu'on venait d'ouvrir.
 */
export function useProgressiveList<T>(
  items: T[],
  { initial = 6, step = 12, resetKey }: { initial?: number; step?: number; resetKey?: unknown } = {}
) {
  const [state, setState] = useState({ count: initial, initial, resetKey });

  // Le repli se fait pendant le rendu, pas dans un effet : un effet ne
  // s'exécute qu'après la peinture, et la liste s'afficherait tronquée le
  // temps d'une image. Cela se voit surtout là où `initial` suit la longueur
  // de la liste (aperçu désactivé) : les morceaux arrivent, le premier rendu
  // n'en montrerait aucun. React accepte cette mise à jour et relance le
  // rendu du composant avant de rien afficher.
  let count = state.count;
  if (state.initial !== initial || state.resetKey !== resetKey) {
    count = initial;
    setState({ count: initial, initial, resetKey });
  }

  const visible = items.slice(0, count);

  return {
    visible,
    hasMore: items.length > visible.length,
    remaining: items.length - visible.length,
    showMore: () => setState((s) => ({ ...s, count: s.count + step })),
  };
}

/**
 * Bouton « Voir plus » commun à toutes les listes déroulables.
 *
 * `full` colle le bouton au bas d'une carte, sur toute sa largeur (listes
 * en rangées) ; sinon c'est une pastille bordée, à centrer sous une grille.
 * Le nombre restant n'est annoncé qu'aux lecteurs d'écran : à l'œil, la
 * liste elle-même le montre.
 */
export function ShowMoreButton({
  label,
  remaining,
  onClick,
  full = false,
  className = "",
}: {
  label: string;
  remaining: number;
  onClick: () => void;
  full?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 text-sm font-semibold text-accent transition-colors hover:bg-base ${
        full ? "w-full py-3.5" : "rounded-2xl border border-border px-5 py-2.5"
      } ${className}`}
    >
      {label}
      <ChevronDown size={16} />
      <span className="sr-only">
        ({remaining} restant{remaining > 1 ? "s" : ""})
      </span>
    </button>
  );
}

const clampClasses: Record<3 | 4 | 6, string> = {
  3: "line-clamp-3",
  4: "line-clamp-4",
  6: "line-clamp-6",
};

/**
 * Texte long tronqué à quelques lignes, déroulable et repliable — une
 * biographie de vingt lignes ne doit pas repousser hors de l'écran ce qui
 * la suit.
 *
 * Le bouton n'apparaît qu'au-delà du seuil : proposer de dérouler trois
 * lignes déjà entières ne ferait qu'ajouter un clic sans contenu derrière.
 */
export function ExpandableText({
  text,
  clamp = 4,
  threshold = 320,
  className = "",
}: {
  text: string;
  clamp?: 3 | 4 | 6;
  /** Longueur à partir de laquelle le texte est replié. */
  threshold?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const long = text.length > threshold;

  return (
    <div>
      <p className={`whitespace-pre-line ${className} ${long && !open ? clampClasses[clamp] : ""}`}>{text}</p>
      {long && (
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-2 flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
        >
          {open ? "Voir moins" : "Voir plus"}
          <ChevronDown size={13} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
        </button>
      )}
    </div>
  );
}
