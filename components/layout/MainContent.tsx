"use client";

import { usePlayer } from "@/context/PlayerProvider";
import { useOnlineStatus } from "@/context/OnlineStatusProvider";
import { PageTransition } from "@/components/layout/PageTransition";

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

  // OfflineBanner est en position fixed (h-8) au-dessus du contenu quand
  // hors-ligne : sans cet espace réservé en plus, elle recouvre le tout
  // début de la page (voir components/ui/OfflineBanner.tsx).
  const topPad = isOnline ? "pt-14 md:pt-0" : "pt-[5.5rem] md:pt-8";

  return (
    // pb-16 (mobile) : hauteur de la barre de nav mobile fixe (MobileNav,
    // toujours affichée) — cf. le décalage bottom-16 qu'utilise déjà
    // MiniPlayerBar pour se caler juste au-dessus d'elle. md:pb-0 sur
    // desktop, qui n'a pas de nav basse fixe.
    // md:pb-28 = hauteur de la carte du lecteur (86px) + sa marge basse
    // (16px), arrondi au cran Tailwind supérieur (112px).
    <main className={`min-w-0 flex-1 ${topPad} ${currentSong ? "pb-40 md:pb-28" : "pb-16 md:pb-0"}`}>
      <PageTransition>{children}</PageTransition>
    </main>
  );
}
