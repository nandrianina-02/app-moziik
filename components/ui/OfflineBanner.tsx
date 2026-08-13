"use client";

import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/context/OnlineStatusProvider";

export function OfflineBanner() {
  const { isOnline } = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-14 md:top-0 inset-x-0 z-20 flex items-center justify-center gap-1.5 bg-accent/90 text-base text-xs font-medium py-1.5">
      <WifiOff size={12} />
      Mode hors-ligne — tes actions seront synchronisées au retour du réseau
    </div>
  );
}
