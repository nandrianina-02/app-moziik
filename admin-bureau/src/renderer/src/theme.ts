/** Le thème choisi, gardé sur ce poste : sombre par défaut, comme le site. */
export type Theme = "sombre" | "clair";

const CLE = "moziik-admin:theme";

export function themeEnregistre(): Theme {
  try {
    return localStorage.getItem(CLE) === "clair" ? "clair" : "sombre";
  } catch {
    return "sombre";
  }
}

export function appliquerTheme(theme: Theme) {
  document.documentElement.classList.toggle("clair", theme === "clair");
  try {
    localStorage.setItem(CLE, theme);
  } catch {
    // Stockage indisponible : le choix vaut pour la session seulement.
  }
}
