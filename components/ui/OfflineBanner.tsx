"use client";

import Link from "next/link";
import { CloudOff, ChevronRight } from "lucide-react";
import { useOnlineStatus } from "@/context/OnlineStatusProvider";

/**
 * Bandeau « mode hors-ligne ».
 *
 * Il était auparavant en `position: fixed`, ce qui le posait par-dessus la
 * page : sur mobile il recouvrait la première ligne de contenu, et sur
 * bureau il se glissait derrière la barre supérieure (même `z-index`, mais
 * déclaré plus tôt dans l'arbre) — il masquait donc la barre de recherche
 * tout en réservant 32 px de vide inutile plus bas.
 *
 * Il est désormais dans le flux, en tête de la colonne de contenu : il ne
 * peut plus recouvrir quoi que ce soit, et il s'aligne sur la largeur du
 * contenu au lieu de barrer aussi la sidebar. Contrepartie assumée : il
 * défile avec la page au lieu de rester collé en haut.
 *
 * `pt-14` sur mobile uniquement : l'en-tête mobile est en `fixed` et haut
 * de 56 px. C'est ce bandeau qui dégage cet espace quand il est présent —
 * MainContent le sait et retire alors son propre décalage.
 */
export function OfflineBanner() {
  const { isOnline } = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="px-4 pt-14 md:px-6 md:pt-0 lg:px-10 print:hidden">
      <div
        role="status"
        className="mt-3 flex items-center gap-3 rounded-xl2 border border-warning/40 bg-warning/10 px-3 py-2.5 sm:px-4"
      >
        <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-warning/15 text-warning">
          <CloudOff size={16} />
          {/* Point de statut : signale que l'état est vivant et sera levé
              tout seul dès le retour du réseau. */}
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-base bg-warning" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-tight text-ink">Mode hors-ligne</span>
          <span className="block text-xs leading-snug text-ink-muted">
            Synchronisation au retour du réseau.
          </span>
        </span>

        <Link
          href="/hors-ligne"
          className="flex shrink-0 items-center gap-0.5 rounded-lg border border-warning/40 px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-warning hover:bg-warning/10"
        >
          <span className="hidden xs:inline">Mes titres</span>
          <span className="xs:hidden">Titres</span>
          <ChevronRight size={13} />
        </Link>
      </div>
    </div>
  );
}
