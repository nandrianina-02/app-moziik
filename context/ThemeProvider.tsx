"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useSiteConfig } from "@/context/SiteConfigProvider";
import {
  THEME_PAR_DEFAUT,
  fondSombre,
  normaliserTheme,
  themeVariables,
  type ThemeMode,
  type ThemePreference,
} from "@/lib/theme";

/**
 * Le moteur de thème.
 *
 * Trois sources, dans cet ordre : les couleurs personnelles d'un membre
 * Premium, à défaut le thème choisi par l'administration, à défaut la
 * palette d'origine. Le mode sombre/clair, lui, reste un réglage de confort
 * local à l'appareil — l'interrupteur de l'en-tête existe pour tout le
 * monde, et le thème enregistré n'en fixe que la valeur de départ.
 *
 * L'application se fait par variables CSS posées sur <html> : les jetons
 * Tailwind du projet lisent tous `rgb(var(--color-x) / <alpha>)`, donc une
 * seule écriture repeint la page entière, sans recharger ni réécrire une
 * classe.
 */

const CLE_MODE = "moziik-theme";
/** Dernier thème appliqué, relu par le script anti-flash de layout.tsx. */
export const CLE_VARIABLES = "moziik-theme-vars";

type ThemeContextValue = {
  theme: ThemeMode;
  toggleTheme: () => void;
  /** Fixe le mode de cet appareil, sans passer par la bascule. */
  setMode: (mode: ThemeMode) => void;
  /** Le thème effectivement appliqué (personnel ou celui du site). */
  preference: ThemePreference;
  /** Le thème personnel enregistré, s'il y en a un. */
  themePersonnel: ThemePreference | null;
  /** Le thème par défaut du site. */
  themeSite: ThemePreference;
  /** Ce compte a-t-il le droit de personnaliser ? */
  peutPersonnaliser: boolean;
  /** Aperçu en direct : applique sans enregistrer. `null` pour revenir au réel. */
  previsualiser: (theme: ThemePreference | null) => void;
  /** Recharge les préférences depuis le serveur (après un enregistrement). */
  rafraichir: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
  setMode: () => {},
  preference: THEME_PAR_DEFAUT,
  themePersonnel: null,
  themeSite: THEME_PAR_DEFAUT,
  peutPersonnaliser: false,
  previsualiser: () => {},
  rafraichir: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  // Le thème du site arrive avec le reste de la configuration publique :
  // une seule requête pour les deux, et le rafraîchissement déclenché après
  // un enregistrement en administration profite aussi au thème.
  const configSite = useSiteConfig();
  const [themeSite, setThemeSite] = useState<ThemePreference>(THEME_PAR_DEFAUT);
  const [themePersonnel, setThemePersonnel] = useState<ThemePreference | null>(null);
  const [peutPersonnaliser, setPeutPersonnaliser] = useState(false);
  const [apercu, setApercu] = useState<ThemePreference | null>(null);
  // `null` tant que le stockage local n'a pas été lu : le mode enregistré
  // dans le thème sert de valeur de départ, mais un choix explicite de
  // l'appareil doit primer, et il n'est lisible qu'après le montage.
  const [modeLocal, setModeLocal] = useState<ThemeMode | null>(null);

  useEffect(() => {
    const stocke = localStorage.getItem(CLE_MODE);
    if (stocke === "dark" || stocke === "light") setModeLocal(stocke);
  }, []);

  useEffect(() => {
    if (configSite.theme) setThemeSite(normaliserTheme(configSite.theme));
  }, [configSite.theme]);

  // Thème personnel : demandé une fois la session connue.
  const chargerPersonnel = useCallback(() => {
    if (status !== "authenticated") {
      setThemePersonnel(null);
      setPeutPersonnaliser(false);
      return;
    }
    fetch("/api/me/theme")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setThemePersonnel(data.theme ? normaliserTheme(data.theme) : null);
        setPeutPersonnaliser(Boolean(data.hasPremium));
        if (data.siteTheme) setThemeSite(normaliserTheme(data.siteTheme));
      })
      .catch(() => {
        // Sans réponse, le compte suit simplement le thème du site.
      });
  }, [status]);

  useEffect(() => {
    chargerPersonnel();
  }, [chargerPersonnel]);

  // Un thème personnel n'est appliqué que tant que l'abonnement l'autorise ;
  // il reste enregistré en base dans tous les cas.
  const reel = (peutPersonnaliser && themePersonnel) || themeSite;
  const preference = apercu ?? reel;
  // Pendant un aperçu, c'est le mode de l'aperçu qui s'applique : l'écran
  // de personnalisation doit montrer exactement ce qui sera enregistré, y
  // compris quand l'appareil est resté sur l'autre mode.
  const mode: ThemeMode = apercu ? apercu.mode : modeLocal ?? preference.mode;

  // Application : variables CSS + classe `light`, et copie dans le stockage
  // local pour que le prochain chargement peigne la page avant le premier
  // rendu (voir le script `theme-init` de layout.tsx).
  useEffect(() => {
    const variables = themeVariables(preference, mode);
    const racine = document.documentElement;
    for (const [nom, valeur] of Object.entries(variables)) racine.style.setProperty(nom, valeur);

    const clair = !fondSombre(preference, mode);
    racine.classList.toggle("light", clair);

    try {
      localStorage.setItem(CLE_VARIABLES, JSON.stringify({ variables, clair }));
    } catch {
      // Stockage refusé : on perd l'anti-flash, pas le thème.
    }
  }, [preference, mode]);

  const setMode = useCallback((suivant: ThemeMode) => {
    setModeLocal(suivant);
    try {
      localStorage.setItem(CLE_MODE, suivant);
    } catch {
      // Sans stockage, le choix ne survit pas au rechargement.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setMode((modeLocal ?? preference.mode) === "dark" ? "light" : "dark");
  }, [setMode, modeLocal, preference.mode]);

  const valeur = useMemo<ThemeContextValue>(
    () => ({
      theme: mode,
      toggleTheme,
      setMode,
      preference,
      themePersonnel,
      themeSite,
      peutPersonnaliser,
      previsualiser: setApercu,
      rafraichir: chargerPersonnel,
    }),
    [mode, toggleTheme, setMode, preference, themePersonnel, themeSite, peutPersonnaliser, chargerPersonnel]
  );

  return <ThemeContext.Provider value={valeur}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
