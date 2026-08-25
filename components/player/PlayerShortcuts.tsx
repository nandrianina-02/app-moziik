"use client";

import { usePlayerShortcuts } from "@/components/player/hooks/usePlayerShortcuts";

/**
 * Monte les raccourcis clavier globaux du lecteur.
 *
 * Composant sans rendu : il ne peut pas vivre dans MiniPlayerBar, qui
 * renvoie `null` tant qu'aucun titre n'est chargé — les raccourcis
 * seraient alors posés puis retirés à chaque changement de file.
 */
export function PlayerShortcuts() {
  usePlayerShortcuts();
  return null;
}
