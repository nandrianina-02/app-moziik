"use client";

import { createContext, useContext, useEffect, useState } from "react";

const COLLAPSE_KEY = "moziik:sidebar-collapsed";
const PANNEAU_KEY = "moziik:panneau-lecture";

/**
 * Les deux colonnes qui encadrent le contenu sur ordinateur : la barre
 * latérale à gauche (repliable), le panneau « En cours de lecture » à
 * droite (affichable). Le lecteur, les coins du cadre et la mise en page
 * ont tous besoin de savoir quelle place elles prennent.
 */
const SidebarContext = createContext<{
  collapsed: boolean;
  toggleCollapsed: () => void;
  panneauLecture: boolean;
  basculerPanneauLecture: () => void;
}>({ collapsed: false, toggleCollapsed: () => {}, panneauLecture: true, basculerPanneauLecture: () => {} });

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  // Ouvert par défaut, comme sur Spotify : il ne s'affiche de toute façon
  // que sur un grand écran, et seulement pendant une écoute.
  const [panneauLecture, setPanneauLecture] = useState(true);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    setPanneauLecture(localStorage.getItem(PANNEAU_KEY) !== "0");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  function basculerPanneauLecture() {
    setPanneauLecture((prev) => {
      const next = !prev;
      localStorage.setItem(PANNEAU_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <SidebarContext.Provider value={{ collapsed, toggleCollapsed, panneauLecture, basculerPanneauLecture }}>
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => useContext(SidebarContext);
