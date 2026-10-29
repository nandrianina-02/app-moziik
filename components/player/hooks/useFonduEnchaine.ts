"use client";

import { useEffect, useRef } from "react";

/**
 * Le fondu enchaîné : la fin d'un titre s'efface pendant que le suivant
 * monte, sans silence entre les deux.
 *
 * L'élément audio principal reste la seule source de vérité du lecteur
 * (titre en cours, progression, file, écoutes déclarées) : il passe au
 * titre suivant exactement comme d'habitude. Ce qui change, c'est la fin
 * du titre qui s'en va. Quelques secondes avant le fondu, un second
 * élément est préparé sur ce même titre, à la bonne position. Au moment
 * du fondu, il prend le relais du son en un instant, l'élément principal
 * passe au titre suivant, et les deux se croisent : la fin s'efface,
 * l'entrée monte.
 *
 * Rien ne se fait sans titre suivant déjà connu dans la file, ni en
 * répétition d'un titre, ni avec le minuteur « fin du morceau » : dans ces
 * cas, le titre va jusqu'au bout comme avant. Un échec à n'importe quelle
 * étape (navigateur qui refuse la seconde lecture, graphe audio absent)
 * laisse aussi le titre finir normalement.
 */

type Moteur = {
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
  brancherAnnexe: (element: HTMLAudioElement) => GainNode | null;
  contexteAudio: () => AudioContext | null;
  couperPiste: (secondes: number) => void;
  entrerEnFondu: (secondes: number) => void;
};

/** Combien de secondes avant le fondu la fin du titre est préparée sur l'élément annexe. */
const AVANCE_PREPARATION_S = 12;
/** Le passage du son d'un élément à l'autre : assez long pour ne pas claquer, trop court pour s'entendre. */
const RELAIS_S = 0.06;

type Etat = "repos" | "prepare" | "relais" | "sortie";

export function useFonduEnchaine({
  moteur,
  dureeS,
  peutEnchainer,
  enchainer,
  gainCourant,
}: {
  moteur: Moteur;
  /** Durée du fondu en secondes ; 0 le désactive. */
  dureeS: number;
  /** Un titre suivant est connu, et rien n'interdit d'y passer en avance. */
  peutEnchainer: () => boolean;
  /** Passe au titre suivant : le `playNext` du lecteur. */
  enchainer: () => void;
  /** Le gain (volume égal) du titre en cours, que sa fin doit garder. */
  gainCourant: () => number;
}) {
  const annexeRef = useRef<HTMLAudioElement | null>(null);
  const etatRef = useRef<Etat>("repos");
  const sourcePrepareeRef = useRef<string | null>(null);
  // Les fonctions de ce rendu-ci : l'écoute de l'élément ne se refait pas
  // à chaque rendu, mais elle doit voir la file telle qu'elle est.
  const rappels = useRef({ peutEnchainer, enchainer, gainCourant });
  rappels.current = { peutEnchainer, enchainer, gainCourant };

  useEffect(() => {
    const principal = moteur.audioRef.current;
    if (!principal || dureeS <= 0) return;
    const minuteries: number[] = [];

    const sourceDe = (el: HTMLAudioElement) => el.currentSrc || el.src;

    function annexe(): HTMLAudioElement {
      if (!annexeRef.current) {
        const el = new Audio();
        // Comme l'élément principal : sans cela, le graphe Web Audio ne
        // rendrait que du silence pour un fichier servi par un autre domaine.
        el.crossOrigin = "anonymous";
        el.preload = "auto";
        annexeRef.current = el;
      }
      return annexeRef.current;
    }

    function arreter() {
      const el = annexeRef.current;
      if (el) {
        el.pause();
        el.removeAttribute("src");
        el.load();
      }
      etatRef.current = "repos";
      sourcePrepareeRef.current = null;
    }

    function preparer(duree: number) {
      const el = annexe();
      if (!moteur.brancherAnnexe(el)) return;
      const source = sourceDe(principal!);
      sourcePrepareeRef.current = source;
      etatRef.current = "prepare";
      el.src = source;
      el.playbackRate = principal!.playbackRate;
      // Le navigateur ne charge que ce qui suit cette position : la fin du titre.
      el.addEventListener("loadedmetadata", () => (el.currentTime = Math.max(0, duree - dureeS - 1)), { once: true });
      el.load();
    }

    function relayer() {
      const el = annexeRef.current;
      const ctx = moteur.contexteAudio();
      const gain = el ? moteur.brancherAnnexe(el) : null;
      if (!el || !ctx || !gain) return arreter();
      etatRef.current = "relais";
      el.currentTime = principal!.currentTime;
      el.playbackRate = principal!.playbackRate;
      const niveau = rappels.current.gainCourant();

      el.play()
        .then(() => {
          // Le titre a pu finir, ou l'auditeur passer à un autre, pendant
          // que l'annexe démarrait : on laisse alors le lecteur faire.
          const toujoursLa =
            etatRef.current === "relais" &&
            sourceDe(principal!) === sourcePrepareeRef.current &&
            principal!.duration - principal!.currentTime > 0.3;
          if (!toujoursLa) return arreter();

          const t = ctx.currentTime;
          gain.gain.cancelScheduledValues(t);
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(niveau, t + RELAIS_S);
          moteur.couperPiste(RELAIS_S);

          minuteries.push(
            window.setTimeout(() => {
              if (etatRef.current !== "relais") return;
              etatRef.current = "sortie";
              const t2 = ctx.currentTime;
              const sortie = Math.max(1, Math.min(dureeS, (el.duration || 0) - el.currentTime));
              gain.gain.cancelScheduledValues(t2);
              gain.gain.setValueAtTime(niveau, t2);
              gain.gain.linearRampToValueAtTime(0, t2 + sortie);
              rappels.current.enchainer();
              moteur.entrerEnFondu(dureeS);
              minuteries.push(window.setTimeout(() => etatRef.current === "sortie" && arreter(), sortie * 1000 + 250));
            }, RELAIS_S * 1000)
          );
        })
        .catch(() => arreter());
    }

    function surTemps() {
      const duree = principal!.duration;
      // Un titre trop court pour qu'un fondu ait un sens, ou de durée inconnue.
      if (!Number.isFinite(duree) || duree < dureeS * 2 + 10) return;
      const reste = duree - principal!.currentTime;
      const etat = etatRef.current;

      if (etat === "prepare" && sourceDe(principal!) !== sourcePrepareeRef.current) {
        // L'auditeur a changé de titre entre-temps.
        arreter();
        return;
      }
      if (etat === "repos" && reste <= dureeS + AVANCE_PREPARATION_S && reste > dureeS + 1) {
        if (rappels.current.peutEnchainer()) preparer(duree);
        return;
      }
      if (etat === "prepare" && reste <= dureeS) {
        if (rappels.current.peutEnchainer()) relayer();
        else arreter();
      }
    }

    // Une vraie pause (pas celle d'un changement de source) arrête aussi la
    // fin qui s'efface : sinon elle continuerait seule, lecteur arrêté.
    function surPause() {
      minuteries.push(
        window.setTimeout(() => {
          const enCours = etatRef.current === "relais" || etatRef.current === "sortie";
          if (enCours && principal!.paused && principal!.readyState >= 2) arreter();
        }, 300)
      );
    }

    principal.addEventListener("timeupdate", surTemps);
    principal.addEventListener("pause", surPause);
    return () => {
      principal.removeEventListener("timeupdate", surTemps);
      principal.removeEventListener("pause", surPause);
      minuteries.forEach((m) => window.clearTimeout(m));
      arreter();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- le moteur est stable, les rappels passent par une ref
  }, [dureeS]);
}
