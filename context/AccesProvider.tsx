"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { VISITEUR_ANONYME, type Visiteur } from "@/lib/acces";
import { publierAccesPremium } from "@/lib/offlineAcces";

/**
 * Qui regarde, et à quoi il a droit.
 *
 * L'abonnement était relu par chaque écran qui en avait besoin — la page
 * du compte, les formules, le lecteur — soit autant d'appels et autant
 * d'occasions que deux endroits n'aient pas la même réponse au même
 * instant. Une seule lecture ici, partagée par tous.
 */

type Contexte = Visiteur & {
  /** Vrai tant que l'abonnement n'a pas été relu : ne rien conclure avant. */
  chargement: boolean;
  /** À rappeler après un paiement ou un octroi, pour relire sans recharger. */
  rafraichir: () => void;
};

const CONTEXTE = createContext<Contexte>({
  ...VISITEUR_ANONYME,
  chargement: true,
  rafraichir: () => {},
});

export function AccesProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [premium, setPremium] = useState(false);
  const [chargement, setChargement] = useState(true);

  const relire = useCallback(() => {
    if (status !== "authenticated") {
      setPremium(false);
      setChargement(status === "loading");
      return;
    }
    fetch("/api/me/subscription")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setPremium(Boolean(data?.hasPremium)))
      // Un échec réseau ne doit pas offrir le premium : on reste au plus
      // restrictif, l'écran suivant relira.
      .catch(() => setPremium(false))
      .finally(() => setChargement(false));
  }, [status]);

  // Le cache hors-ligne n'est pas un composant : il lit l'abonnement par
  // ce canal (voir lib/offlineAcces.ts).
  useEffect(() => {
    publierAccesPremium(premium);
  }, [premium]);

  useEffect(() => {
    relire();
    // Déclenché après un paiement abouti ou un accès offert par
    // l'administration, pour que le lecteur en tienne compte tout de suite.
    window.addEventListener("moziik-abonnement-change", relire);
    return () => window.removeEventListener("moziik-abonnement-change", relire);
  }, [relire]);

  return (
    <CONTEXTE.Provider
      value={{ connecte: status === "authenticated", premium, chargement, rafraichir: relire }}
    >
      {children}
    </CONTEXTE.Provider>
  );
}

export const useAcces = () => useContext(CONTEXTE);
