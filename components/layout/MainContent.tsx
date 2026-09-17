"use client";

import { usePlayer } from "@/context/PlayerProvider";
import { useOnlineStatus } from "@/context/OnlineStatusProvider";
import { PageTransition } from "@/components/layout/PageTransition";
import { useClavierVisible } from "@/hooks/useClavierVisible";

/**
 * Réserve en bas de page exactement la place occupée par les éléments
 * fixes (mini-lecteur, navigation mobile), et seulement quand ils sont
 * réellement affichés : MiniPlayerBar renvoie `null` tant qu'aucun titre
 * n'est lancé, sans quoi un bandeau vide subsistait en bas de chaque page.
 * Composant client dédié pour pouvoir lire `usePlayer()`/`useOnlineStatus()`
 * sans transformer tout app/layout.tsx (racine, server component) en
 * client component.
 */
export function MainContent({ children }: { children: React.ReactNode }) {
  const { currentSong } = usePlayer();
  const { isOnline } = useOnlineStatus();
  const clavierVisible = useClavierVisible();

  // pt-14 (mobile) : hauteur de l'en-tête mobile, qui est en `fixed`.
  // Hors-ligne, c'est le bandeau — rendu juste au-dessus, dans le flux —
  // qui dégage déjà cet espace ; le répéter ici décalerait le contenu deux
  // fois (voir components/ui/OfflineBanner.tsx).
  const topPad = isOnline ? "pt-14 md:pt-0" : "pt-0";

  return (
    // pb-16 (mobile) : hauteur de la barre de nav mobile fixe (MobileNav,
    // toujours affichée) — cf. le décalage bottom-16 qu'utilise déjà
    // MiniPlayerBar pour se caler juste au-dessus d'elle. md:pb-0 sur
    // desktop, qui n'a pas de nav basse fixe.
    // md:pb-28 = hauteur de la carte du lecteur (86px) + sa marge basse
    // (16px), arrondi au cran Tailwind supérieur (112px).
    // Clavier ouvert sur téléphone : les deux barres se retirent (elles
    // se poseraient au-dessus du clavier), donc la réserve qu'elles
    // occupaient n'a plus lieu d'être — sans quoi il resterait cent
    // soixante pixels de vide entre le contenu et le clavier, sur l'écran
    // où la place manque le plus.
    <main
      className={`min-w-0 flex-1 ${topPad} ${
        clavierVisible
          ? currentSong
            ? "pb-0 md:pb-28"
            : "pb-0 md:pb-0"
          : currentSong
            ? "pb-40 md:pb-28"
            : "pb-16 md:pb-0"
      }`}
    >
      <PageTransition>{children}</PageTransition>
    </main>
  );
}
