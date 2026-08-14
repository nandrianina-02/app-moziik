"use client";

import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/context/OnlineStatusProvider";

export function OfflineBanner() {
  const { isOnline } = useOnlineStatus();

  if (isOnline) return null;

  return (
    // Hauteur fixe (h-8) plutôt qu'intrinsèque au contenu : MainContent a
    // besoin de connaître cette hauteur exacte pour réserver l'espace
    // correspondant en haut de la page (sinon la bannière, en position
    // fixed, recouvre le tout début du contenu — voir MainContent.tsx).
    <div className="fixed top-14 md:top-0 inset-x-0 z-20 flex h-8 items-center justify-center gap-1.5 bg-accent/90 text-base text-xs font-medium">
      <WifiOff size={12} />
      Mode hors-ligne — tes actions seront synchronisées au retour du réseau
    </div>
  );
}
