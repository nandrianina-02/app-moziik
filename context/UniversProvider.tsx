"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useSiteConfig } from "@/context/SiteConfigProvider";
import {
  COOKIE_UNIVERS,
  COOKIE_UNIVERS_MAX_AGE,
  UNIVERS_PAR_DEFAUT,
  estUnivers,
  type Univers,
} from "@/lib/univers";

/**
 * Le sélecteur d'univers, et ce qu'il déclenche.
 *
 * LE COOKIE FAIT LE GROS DU TRAVAIL
 *
 * Changer d'univers doit changer ce que renvoient une trentaine de
 * points d'entrée : accueil, recherche, radio, station, recommandations,
 * prolongement de file. Les faire tous porter un paramètre reviendrait à
 * l'oublier quelque part — et l'oubli ne se verrait qu'au vingtième titre
 * d'une lecture automatique. Le choix voyage donc par cookie, et chaque
 * route le lit d'elle-même (lib/universServer.ts).
 *
 * CE QUI SE RECHARGE, ET CE QUI NE SE RECHARGE PAS
 *
 * `version` s'incrémente à chaque changement : les écrans qui listent du
 * contenu s'y abonnent et refont leur requête. La lecture en cours, elle,
 * n'est pas interrompue — couper le morceau qu'on écoute pour appliquer
 * un réglage serait le pire moment pour le faire. C'est la SUITE qui
 * change d'univers : le lecteur vide sa réserve et redemande une file,
 * qui arrive du bon côté.
 */

type UniversContextValue = {
  univers: Univers;
  setUnivers: (univers: Univers) => void;
  /** S'incrémente à chaque changement. À mettre dans les dépendances d'un chargement. */
  version: number;
  /** Faux tant que le choix réel n'est pas connu (cookie et compte non lus). */
  pret: boolean;
};

const UniversContext = createContext<UniversContextValue>({
  univers: UNIVERS_PAR_DEFAUT,
  setUnivers: () => {},
  version: 0,
  pret: false,
});

function lireCookie(): Univers | null {
  if (typeof document === "undefined") return null;
  const trouve = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${COOKIE_UNIVERS}=`))
    ?.slice(COOKIE_UNIVERS.length + 1);
  return estUnivers(trouve) ? trouve : null;
}

function ecrireCookie(univers: Univers) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_UNIVERS}=${univers}; path=/; max-age=${COOKIE_UNIVERS_MAX_AGE}; SameSite=Lax`;
}

export function UniversProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const configSite = useSiteConfig();
  const [univers, setEtat] = useState<Univers>(UNIVERS_PAR_DEFAUT);
  const [version, setVersion] = useState(0);
  const [pret, setPret] = useState(false);

  // Le cookie est la source la plus rapide : il est là avant même que la
  // configuration du site n'arrive, et c'est celui que le serveur a
  // employé pour rendre la réponse en cours.
  useEffect(() => {
    const cookie = lireCookie();
    if (cookie) {
      setEtat(cookie);
      setPret(true);
    }
  }, []);

  // Pas de cookie : on suit l'univers par défaut du site, et on le fige
  // pour que le serveur voie la même chose que le navigateur.
  useEffect(() => {
    if (pret || lireCookie()) return;
    const defaut = estUnivers(configSite.defaultUnivers) ? configSite.defaultUnivers : UNIVERS_PAR_DEFAUT;
    setEtat(defaut);
    ecrireCookie(defaut);
    setPret(true);
  }, [configSite.defaultUnivers, pret]);

  // Le compte prime sur l'appareil : c'est ce qui fait suivre le choix
  // d'un téléphone à un ordinateur.
  useEffect(() => {
    if (status !== "authenticated") return;
    let annule = false;
    fetch("/api/me/univers")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (annule || !estUnivers(data?.univers)) return;
        setPret(true);
        setEtat((actuel) => {
          if (actuel === data.univers) return actuel;
          ecrireCookie(data.univers);
          setVersion((v) => v + 1);
          return data.univers;
        });
      })
      .catch(() => {});
    return () => {
      annule = true;
    };
  }, [status]);

  const setUnivers = useCallback(
    (choix: Univers) => {
      setEtat((actuel) => {
        if (actuel === choix) return actuel;
        ecrireCookie(choix);
        setVersion((v) => v + 1);
        return choix;
      });
      // L'enregistrement en base est le seul aller-retour, et il n'est
      // pas bloquant : l'écran a déjà changé d'univers quand la réponse
      // arrive. Un échec laisse simplement le choix local à cet appareil.
      fetch("/api/me/univers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ univers: choix }),
      }).catch(() => {});
    },
    []
  );

  const valeur = useMemo(
    () => ({ univers, setUnivers, version, pret }),
    [univers, setUnivers, version, pret]
  );

  return <UniversContext.Provider value={valeur}>{children}</UniversContext.Provider>;
}

export function useUnivers() {
  return useContext(UniversContext);
}
