"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** Le nombre d'éléments en attente, par adresse de page (app/api/admin/a-traiter). */
export type CompteursATraiter = Record<string, number>;

const Contexte = createContext<CompteursATraiter>({});

/**
 * Relu à chaque changement de page : après avoir traité des doublons, on
 * revient à la navigation avec un compte juste, sans recharger le site.
 */
export function ATraiterProvider({ children }: { children: React.ReactNode }) {
  const chemin = usePathname();
  const [compteurs, setCompteurs] = useState<CompteursATraiter>({});

  useEffect(() => {
    const controleur = new AbortController();
    fetch("/api/admin/a-traiter", { signal: controleur.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCompteurs(d))
      .catch(() => {
        // Les compteurs sont un repère : sans eux, la navigation reste utilisable.
      });
    return () => controleur.abort();
  }, [chemin]);

  return <Contexte.Provider value={compteurs}>{children}</Contexte.Provider>;
}

export function useATraiter() {
  return useContext(Contexte);
}
