import { useSyncExternalStore } from "react";

/*
 * Les préférences de ce poste : apparence, démarrage, téléversements. Elles
 * vivent dans le stockage local de la fenêtre (rien ne part au site) et se
 * lisent aussi hors de React, l'envoi en arrière-plan en a besoin.
 */

export type ChoixTheme = "sombre" | "clair" | "systeme";

export interface Preferences {
  theme: ChoixTheme;
  /** Taille de l'interface : 0,9 à 1,25. */
  zoom: number;
  animations: boolean;
  /** La page ouverte au lancement. */
  pageDemarrage: string;
  /** Actualisation des compteurs, en secondes ; 0 pour jamais. */
  actualisation: number;
  notifications: boolean;
  /** Préparer les qualités 64, 128 et 320 kb/s à l'envoi. */
  qualites: boolean;
  /** Genre donné à un fichier dont la balise est vide ou inconnue du site. */
  genreDefaut: string;
}

export const PAR_DEFAUT: Preferences = {
  theme: "sombre",
  zoom: 1,
  animations: true,
  pageDemarrage: "tableau",
  actualisation: 120,
  notifications: true,
  qualites: true,
  genreDefaut: "Afrobeat",
};

const CLE = "moziik-admin:preferences";
let courantes: Preferences = lire();
const abonnes = new Set<() => void>();

function lire(): Preferences {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) return { ...PAR_DEFAUT, ...(JSON.parse(brut) as Partial<Preferences>) };
    // Reprise des réglages des versions précédentes, rangés à part.
    const ancien: Partial<Preferences> = {};
    if (localStorage.getItem("moziik-admin:theme") === "clair") ancien.theme = "clair";
    if (localStorage.getItem("moziik-admin:qualites") === "non") ancien.qualites = false;
    return { ...PAR_DEFAUT, ...ancien };
  } catch {
    return { ...PAR_DEFAUT };
  }
}

export const preferences = () => courantes;

export function reglerPreferences(changement: Partial<Preferences>) {
  courantes = { ...courantes, ...changement };
  try {
    localStorage.setItem(CLE, JSON.stringify(courantes));
  } catch {
    // Stockage indisponible : les réglages valent pour la session.
  }
  appliquerPreferences(courantes);
  for (const f of abonnes) f();
}

export function reinitialiserPreferences() {
  reglerPreferences({ ...PAR_DEFAUT });
}

export function usePreferences(): Preferences {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => courantes,
  );
}

const sombreSysteme = window.matchMedia("(prefers-color-scheme: dark)");

/** Le thème réellement affiché, une fois « Système » résolu. */
export function themeEffectif(p: Preferences = courantes): "sombre" | "clair" {
  return p.theme === "systeme" ? (sombreSysteme.matches ? "sombre" : "clair") : p.theme;
}

/** Applique ce qui se voit : thème, taille de l'interface, animations. */
export function appliquerPreferences(p: Preferences = courantes) {
  const racine = document.documentElement;
  racine.classList.toggle("clair", themeEffectif(p) === "clair");
  racine.classList.toggle("sans-animation", !p.animations);
  // zoom agit sur toute la mise en page, textes et marges ensemble, comme
  // le zoom d'un navigateur : rien ne déborde à 125 %.
  racine.style.zoom = String(p.zoom);
}

// « Système » suit Windows en direct, sans relancer le logiciel.
sombreSysteme.addEventListener("change", () => {
  if (courantes.theme === "systeme") {
    appliquerPreferences();
    for (const f of abonnes) f();
  }
});

/** Les crans de taille de l'interface, pour les Paramètres et Ctrl + molette. */
export const ZOOMS = [0.8, 0.9, 1, 1.1, 1.25, 1.5];

/** Passe au cran voisin (sens 1 : plus grand) et rend la nouvelle taille. */
export function zoomVoisin(sens: 1 | -1 | 0): number {
  const actuel = courantes.zoom;
  let i = ZOOMS.findIndex((z) => Math.abs(z - actuel) < 0.001);
  if (i < 0) i = ZOOMS.indexOf(1);
  const z = sens === 0 ? 1 : ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, i + sens))];
  if (z !== actuel) reglerPreferences({ zoom: z });
  return z;
}
