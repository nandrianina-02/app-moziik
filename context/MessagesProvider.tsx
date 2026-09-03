"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

/**
 * Le nombre de messages non lus, partagé par toute la navigation.
 *
 * POURQUOI UN CONTEXTE ET PAS UN HOOK PAR COMPOSANT
 *
 * La pastille apparaît dans la barre latérale et dans la navigation
 * mobile, qui sont montées en même temps. Deux hooks indépendants
 * interrogeraient le serveur deux fois par battement pour afficher le
 * même chiffre — et pourraient afficher deux chiffres différents.
 *
 * LE BATTEMENT EST LENT, ET S'ARRÊTE
 *
 * Une minute, suspendue quand l'onglet est caché. C'est une pastille :
 * la voir apparaître avec trente secondes de retard n'a jamais gêné
 * personne, et la messagerie ouverte a son propre rafraîchissement,
 * bien plus vif. Sur la page /messages, le compteur se recale à chaque
 * navigation plutôt que d'attendre le battement.
 */

const PERIODE_MS = 60_000;

const Contexte = createContext<{ nonLus: number; rafraichir: () => void }>({
  nonLus: 0,
  rafraichir: () => {},
});

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();
  const [nonLus, setNonLus] = useState(0);

  const rafraichir = useCallback(async () => {
    if (status !== "authenticated") {
      setNonLus(0);
      return;
    }
    try {
      const res = await fetch("/api/messagerie/non-lus");
      if (!res.ok) return;
      const data = (await res.json()) as { nonLus: number };
      setNonLus(data.nonLus);
    } catch {
      /* la pastille garde sa valeur précédente plutôt que de disparaître */
    }
  }, [status]);

  useEffect(() => {
    void rafraichir();
  }, [rafraichir, pathname]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const battement = setInterval(() => {
      if (!document.hidden) void rafraichir();
    }, PERIODE_MS);
    return () => clearInterval(battement);
  }, [status, rafraichir]);

  return <Contexte.Provider value={{ nonLus, rafraichir }}>{children}</Contexte.Provider>;
}

export function useMessagesNonLus() {
  return useContext(Contexte);
}
