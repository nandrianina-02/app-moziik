"use client";

import { usePlayer } from "@/context/PlayerProvider";
import { useOnlineStatus } from "@/context/OnlineStatusProvider";
import { PageTransition } from "@/components/layout/PageTransition";

/**
 * `<main>` réserve en permanence l'espace du mini-lecteur (pb-40/pb-24)
 * même quand rien ne joue — MiniPlayerBar renvoie `null` dans ce cas
 * (voir components/player/MiniPlayerBar.tsx), ce qui laissait un bandeau
 * vide en bas de chaque page tant qu'aucun titre n'avait été lancé.
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
    <main className={`min-w-0 flex-1 ${topPad} ${currentSong ? "pb-40 md:pb-20" : "pb-16 md:pb-0"}`}>
      <PageTransition>{children}</PageTransition>
    </main>
  );
}
