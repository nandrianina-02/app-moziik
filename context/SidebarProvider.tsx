"use client";

import { createContext, useContext, useEffect, useState } from "react";

const COLLAPSE_KEY = "moziik:sidebar-collapsed";

/**
 * État de repli de la sidebar, partagé hors de `<Sidebar />`.
 *
 * La sidebar est un enfant flex de largeur variable (w-20 replié / w-64
 * déplié), alors que le mini-lecteur est en `position: fixed` : sans
 * connaître cette largeur, il s'étendait sous la sidebar au lieu de
 * rester dans la zone de contenu. Ce contexte permet au lecteur de se
 * décaler exactement de la largeur courante.
 */
const SidebarContext = createContext<{
  collapsed: boolean;
  toggleCollapsed: () => void;
}>({ collapsed: false, toggleCollapsed: () => {} });

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // Démarre "déplié" : valeur identique côté serveur et client, donc
  // aucun risque de désynchronisation d'hydratation. La préférence
  // enregistrée est appliquée juste après le montage.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <SidebarContext.Provider value={{ collapsed, toggleCollapsed }}>{children}</SidebarContext.Provider>
  );
}

export const useSidebar = () => useContext(SidebarContext);
