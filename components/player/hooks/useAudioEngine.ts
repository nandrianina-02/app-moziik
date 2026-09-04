"use client";

import { useEffect, useRef } from "react";
import {
  dbVersGain,
  reglageBass,
  FREQ_CLARTE,
  FREQ_POIDS,
  FREQ_PROFONDEUR,
  NIVEAU_BASS_PAR_DEFAUT,
  Q_CLARTE,
  Q_POIDS,
  Q_PROFONDEUR,
  type NiveauBass,
} from "@/components/player/constants/bassBoost";

/**
 * Encapsule un <audio> et une chaîne Web Audio API.
 *
 * L'égaliseur graphique 10 bandes a été retiré : il demandait à
 * l'auditeur de savoir ce qu'il faisait, et ses réglages agressifs
 * écrêtaient. À la place, un Bass Boost à cinq niveaux dont chacun est un
 * jeu de filtres cohérent (voir constants/bassBoost.ts pour la courbe
 * mesurée et le choix des fréquences).
 *
 * Chaîne du signal :
 *
 *   source
 *     -> cloche 75 Hz          (le poids)
 *     -> cloche 45 Hz          (la profondeur)
 *     -> cloche 300 Hz, gain<0 (dégage la voix)
 *     -> preGain (atténuation) (marge anti-écrêtage)
 *     -> limiteur              (filet de sécurité)
 *     -> destination
 *
 * Au niveau « Off », tous les gains valent 0 dB et le limiteur passe en
 * ratio 1 : trois filtres en cloche à gain nul sont exactement à
 * l'unité, la chaîne est donc transparente au sens strict — le morceau
 * sort tel qu'il est entré.
 */

/** Durée de transition d'un réglage à l'autre : sans elle, on entend un clic. */
const LISSAGE_S = 0.04;

export function useAudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const poidsRef = useRef<BiquadFilterNode | null>(null);
  const profondeurRef = useRef<BiquadFilterNode | null>(null);
  const clarteRef = useRef<BiquadFilterNode | null>(null);
  const preGainRef = useRef<GainNode | null>(null);
  const limiteurRef = useRef<DynamicsCompressorNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Niveau demandé, mémorisé hors du graphe : il est restauré depuis
  // localStorage au montage, donc avant la première lecture — donc avant
  // l'existence de l'AudioContext. Il est appliqué à sa création.
  const niveauRef = useRef<NiveauBass>(NIVEAU_BASS_PAR_DEFAUT);

  // Sortie choisie, mémorisée pour la même raison.
  // `null` = jamais choisie, on laisse la sortie système.
  const outputDeviceIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = "anonymous";
      // Conserve la hauteur des voix quand la vitesse de lecture change :
      // sans ça, un morceau à 1.5× monte d'une tierce.
      const el = audioRef.current as HTMLAudioElement & { preservesPitch?: boolean };
      el.preservesPitch = true;
    }
  }, []);

  /**
   * Réveille le graphe s'il s'est endormi.
   *
   * Un AudioContext est suspendu par le navigateur quand l'onglet passe à
   * l'arrière-plan, et il ne se rétablit pas seul. Or l'élément audio
   * passe par ce graphe : suspendu, il joue dans le vide — la lecture
   * paraît partie, rien n'en sort, et seul un geste la remet en route.
   *
   * Sans conséquence quand le graphe n'existe pas encore ou tourne déjà.
   */
  function reprendreContexte() {
    const ctx = audioContextRef.current;
    if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  }

  /** Doit être appelé après une interaction utilisateur (politique autoplay des navigateurs). */
  function ensureAudioGraph() {
    if (!audioRef.current || audioContextRef.current) return;

    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(audioRef.current);

    const poids = ctx.createBiquadFilter();
    poids.type = "peaking";
    poids.frequency.value = FREQ_POIDS;
    poids.Q.value = Q_POIDS;
    poids.gain.value = 0;

    const profondeur = ctx.createBiquadFilter();
    profondeur.type = "peaking";
    profondeur.frequency.value = FREQ_PROFONDEUR;
    profondeur.Q.value = Q_PROFONDEUR;
    profondeur.gain.value = 0;

    const clarte = ctx.createBiquadFilter();
    clarte.type = "peaking";
    clarte.frequency.value = FREQ_CLARTE;
    clarte.Q.value = Q_CLARTE;
    clarte.gain.value = 0;

    const preGain = ctx.createGain();
    preGain.gain.value = 1;

    // Filet de sécurité seulement : avec l'atténuation d'entrée calculée
    // dans bassBoost.ts, il ne doit intervenir que sur les crêtes.
    // Ratio 1 = transparent, appliqué tant que le boost est sur « Off ».
    const limiteur = ctx.createDynamicsCompressor();
    limiteur.threshold.value = 0;
    limiteur.knee.value = 0;
    limiteur.ratio.value = 1;
    limiteur.attack.value = 0.003;
    limiteur.release.value = 0.18;

    source.connect(poids);
    poids.connect(profondeur);
    profondeur.connect(clarte);
    clarte.connect(preGain);
    preGain.connect(limiteur);
    limiteur.connect(ctx.destination);

    audioContextRef.current = ctx;
    poidsRef.current = poids;
    profondeurRef.current = profondeur;
    clarteRef.current = clarte;
    preGainRef.current = preGain;
    limiteurRef.current = limiteur;
    sourceRef.current = source;

    // Réglages demandés avant l'existence du graphe.
    appliquerNiveau(niveauRef.current, /* immediat */ true);

    // Sortie mémorisée d'une session à l'autre : les identifiants de
    // périphériques peuvent avoir expiré (matériel débranché, permissions
    // réinitialisées). Dans ce cas on retombe silencieusement sur la sortie
    // système plutôt que d'empêcher la lecture de démarrer.
    if (outputDeviceIdRef.current !== null) {
      ctx.setSinkId?.(outputDeviceIdRef.current).catch(() => {
        outputDeviceIdRef.current = null;
      });
    }
  }

  /**
   * Écrit les valeurs d'un niveau dans le graphe.
   *
   * `setTargetAtTime` plutôt qu'une affectation directe : changer un gain
   * d'un coup pendant la lecture produit une discontinuité du signal,
   * c'est-à-dire un clic parfaitement audible au casque.
   */
  function appliquerNiveau(niveau: NiveauBass, immediat = false) {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    const r = reglageBass(niveau);
    const actif = niveau !== "off";
    const t = ctx.currentTime;
    const tau = immediat ? 0.001 : LISSAGE_S;

    const viser = (param: AudioParam | undefined, valeur: number) => {
      if (!param) return;
      param.cancelScheduledValues(t);
      param.setTargetAtTime(valeur, t, tau);
    };

    viser(poidsRef.current?.gain, r.poidsDb);
    viser(profondeurRef.current?.gain, r.profondeurDb);
    viser(clarteRef.current?.gain, r.clarteDb);
    viser(preGainRef.current?.gain, dbVersGain(r.preGainDb));

    // Le limiteur ne se lisse pas : ses paramètres ne sont pas dans le
    // chemin du signal, un changement instantané ne s'entend pas.
    const lim = limiteurRef.current;
    if (lim) {
      lim.threshold.value = actif ? -1.5 : 0;
      lim.knee.value = actif ? 2 : 0;
      lim.ratio.value = actif ? 12 : 1;
    }
  }

  /** Change le niveau de Bass Boost. Sans effet audible tant que rien ne joue. */
  function setBassBoost(niveau: NiveauBass) {
    niveauRef.current = niveau;
    appliquerNiveau(niveau);
  }

  /**
   * Vitesse de lecture. `preservesPitch` est déjà posé à la création de
   * l'élément, on le repose ici : certains navigateurs le réinitialisent
   * au changement de source.
   */
  function setPlaybackRate(rate: number) {
    const audio = audioRef.current as (HTMLAudioElement & { preservesPitch?: boolean }) | null;
    if (!audio) return;
    audio.preservesPitch = true;
    audio.playbackRate = rate;
  }

  /**
   * Redirige le son vers un autre périphérique de sortie.
   * `deviceId` vient de `navigator.mediaDevices.enumerateDevices()`.
   */
  async function setOutputDevice(deviceId: string) {
    outputDeviceIdRef.current = deviceId;
    const ctx = audioContextRef.current;
    // Pas encore de graphe (aucune lecture lancée) : la valeur est retenue
    // et appliquée par ensureAudioGraph().
    if (!ctx) return;
    if (typeof ctx.setSinkId !== "function") {
      throw new Error("Ce navigateur ne permet pas de choisir la sortie audio.");
    }
    await ctx.setSinkId(deviceId);
  }

  /** Testable dès le montage, sans avoir à instancier un AudioContext. */
  function isOutputSwitchSupported() {
    if (typeof window === "undefined" || !window.AudioContext) return false;
    return typeof window.AudioContext.prototype.setSinkId === "function";
  }

  return {
    audioRef,
    ensureAudioGraph,
    reprendreContexte,
    setBassBoost,
    setPlaybackRate,
    setOutputDevice,
    isOutputSwitchSupported,
  };
}
