"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  CLE_MODE_CHOIX,
  COOKIE_MODE,
  COOKIE_MODE_MAX_AGE,
  MODE_PAR_DEFAUT,
  estMode,
  modeDeLHeure,
  type Mode,
} from "@/lib/modes";

/**
 * Le mode d'écoute, et ce qu'il déclenche.
 *
 * DEUX VALEURS, ET LA DIFFÉRENCE COMPTE
 *
 * `choix` est ce que l'auditeur a décidé : un mode, ou « auto ». `mode`
 * est ce qui s'applique réellement — « auto » résolu par l'horloge du
 * navigateur. Le serveur ne reçoit que le second, dans un cookie, parce
 * qu'il ne peut pas résoudre le premier : il ignore quelle heure il est
 * chez l'auditeur, et lire sa propre horloge proposerait du « Matin » à
 * quelqu'un qui se couche.
 *
 * EN AUTOMATIQUE, LE MODE CHANGE TOUT SEUL
 *
 * Une écoute qui commence à 21 h se poursuit à 23 h : le mode passe de
 * lui-même à « Nuit », et la suite de la file arrive plus calme. Sans le
 * minuteur, il aurait fallu recharger la page pour que l'heure soit prise
 * en compte — ce qui vide l'automatique de son sens.
 */

type ChoixMode = Mode | "auto";

type ModeContextValue = {
  /** Le mode réellement appliqué, « auto » déjà résolu. */
  mode: Mode;
  /** Ce que l'auditeur a choisi. */
  choix: ChoixMode;
  setMode: (choix: ChoixMode) => void;
  /** S'incrémente à chaque changement. À mettre dans les dépendances d'un chargement. */
  version: number;
  /** Faux tant que le choix réel n'est pas connu. */
  pret: boolean;
};

const ModeContext = createContext<ModeContextValue>({
  mode: MODE_PAR_DEFAUT,
  choix: "auto",
  setMode: () => {},
  version: 0,
  pret: false,
});

/** Cadence de relecture de l'horloge en automatique. Un créneau dure des heures. */
const RELECTURE_MS = 10 * 60 * 1000;

function ecrireCookie(mode: Mode) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_MODE}=${mode}; path=/; max-age=${COOKIE_MODE_MAX_AGE}; SameSite=Lax`;
}

function modeAutomatique(): Mode {
  return modeDeLHeure(new Date().getHours());
}

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [choix, setChoix] = useState<ChoixMode>("auto");
  const [mode, setModeApplique] = useState<Mode>(MODE_PAR_DEFAUT);
  const [version, setVersion] = useState(0);
  const [pret, setPret] = useState(false);

  /**
   * Applique un mode : état, cookie, et compteur de version.
   *
   * Le compteur ne bouge que si le mode change réellement. Sans cette
   * garde, la relecture de l'horloge toutes les dix minutes relancerait
   * toutes les requêtes de la page pour rien.
   */
  const appliquer = useCallback((suivant: Mode) => {
    setModeApplique((actuel) => {
      if (actuel === suivant) return actuel;
      ecrireCookie(suivant);
      setVersion((v) => v + 1);
      return suivant;
    });
  }, []);

  // Le choix local d'abord : il est là avant toute requête réseau.
  useEffect(() => {
    let stocke: string | null = null;
    try {
      stocke = localStorage.getItem(CLE_MODE_CHOIX);
    } catch {
      // Stockage indisponible (navigation privée stricte) : on repart en
      // automatique, ce qui est le comportement par défaut de toute façon.
    }
    const initial: ChoixMode = estMode(stocke) ? stocke : "auto";
    setChoix(initial);
    // Le cookie est réécrit même quand il existe déjà : il peut porter le
    // mode d'hier soir, et c'est l'horloge d'aujourd'hui qui compte.
    ecrireCookie(initial === "auto" ? modeAutomatique() : initial);
    setModeApplique(initial === "auto" ? modeAutomatique() : initial);
    setPret(true);
  }, []);

  // En automatique seulement : l'horloge avance, le mode suit.
  const choixRef = useRef<ChoixMode>("auto");
  choixRef.current = choix;
  useEffect(() => {
    if (choix !== "auto") return;
    const minuteur = setInterval(() => {
      if (choixRef.current === "auto") appliquer(modeAutomatique());
    }, RELECTURE_MS);
    return () => clearInterval(minuteur);
  }, [choix, appliquer]);

  // Le compte prime sur l'appareil : c'est ce qui fait suivre le choix
  // d'un téléphone à un ordinateur.
  useEffect(() => {
    if (status !== "authenticated") return;
    let annule = false;
    fetch("/api/me/mode")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (annule || !data) return;
        const distant: ChoixMode | null =
          data.mode === "auto" ? "auto" : estMode(data.mode) ? data.mode : null;
        if (!distant) return;
        setChoix(distant);
        try {
          localStorage.setItem(CLE_MODE_CHOIX, distant);
        } catch {
          // Sans effet : le cookie ci-dessous suffit à cette session.
        }
        appliquer(distant === "auto" ? modeAutomatique() : distant);
      })
      .catch(() => {});
    return () => {
      annule = true;
    };
  }, [status, appliquer]);

  const setMode = useCallback(
    (suivant: ChoixMode) => {
      setChoix(suivant);
      try {
        localStorage.setItem(CLE_MODE_CHOIX, suivant);
      } catch {
        // Sans effet : le cookie porte quand même le mode de cette session.
      }
      appliquer(suivant === "auto" ? modeAutomatique() : suivant);

      // L'enregistrement en base n'est pas bloquant : l'écran a déjà
      // changé de mode quand la réponse arrive.
      fetch("/api/me/mode", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: suivant }),
      }).catch(() => {});
    },
    [appliquer]
  );

  const valeur = useMemo(
    () => ({ mode, choix, setMode, version, pret }),
    [mode, choix, setMode, version, pret]
  );

  return <ModeContext.Provider value={valeur}>{children}</ModeContext.Provider>;
}

export function useMode() {
  return useContext(ModeContext);
}
