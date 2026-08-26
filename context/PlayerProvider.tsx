"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAudioEngine } from "@/components/player/hooks/useAudioEngine";
import {
  NIVEAU_BASS_PAR_DEFAUT,
  NIVEAUX_BASS,
  type NiveauBass,
} from "@/components/player/constants/bassBoost";
import { markOfflineSongPlayed } from "@/lib/offlineCache";
import { idbPut, STORES } from "@/lib/offlineDb";
import { enqueueSyncAction } from "@/lib/syncQueue";
import {
  applyAudioQuality,
  getOfflineSettings,
  setOfflineSettings,
  type AudioQuality,
} from "@/lib/offlineSettings";
import { useSiteConfig } from "@/context/SiteConfigProvider";

export type PlayableSong = {
  _id: string;
  title: string;
  coverUrl: string;
  audioUrl: string;
  duration: number;
  // Nullable : un titre reste en base même si l'artiste (ou son compte) a
  // été supprimé depuis. Toujours vérifier avant d'accéder à artist.xxx.
  artist: { _id: string; stageName: string; verified?: boolean } | null;
  featuring?: { artist: { _id: string; stageName: string; verified?: boolean }; confirmed: boolean }[];
  album?: { _id: string; title: string } | string;
  genre?: string;
  releaseDate?: string;
  likesCount?: number;
  playsCount?: number;
  lyrics?: string;
};

export type RepeatMode = "off" | "all" | "one";

/** Minuteur de veille : durée en minutes, ou arrêt à la fin du morceau. */
export type SleepOption = number | "track" | null;

/** Vitesses proposées par le lecteur. */
export const VITESSES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

// D'où vient la playlist actuellement active — permet à l'UI (file
// d'attente, etc.) d'afficher "Lecture depuis : Recherche « ... »" et
// garantit qu'un nouvel appel à playQueue() documente toujours sa source
// plutôt que de remplacer silencieusement la file en cours.
export type PlaySourceType =
  | "search"
  | "chart"
  | "album"
  | "playlist"
  | "artist"
  | "song"
  | "favorites"
  | "history"
  | "radio"
  | "home"
  | "queue";

export type PlaySource = { type: PlaySourceType; label?: string } | null;

type PlayerContextValue = {
  // État global unique : la playlist active, le morceau en cours, sa
  // position, et la source qui a déclenché cette lecture. `queue` /
  // `currentSong` restent les noms historiques utilisés par la plupart
  // des composants ; `currentPlaylist` / `currentTrack` / `currentIndex`
  // / `playSource` pointent exactement vers les mêmes valeurs.
  queue: PlayableSong[];
  currentSong: PlayableSong | null;
  currentPlaylist: PlayableSong[];
  currentTrack: PlayableSong | null;
  currentIndex: number;
  playSource: PlaySource;
  isPlaying: boolean;
  progress: number; // secondes
  /** Durée réelle du flux si elle est connue, sinon celle enregistrée en base. */
  duration: number;
  isFullPlayerOpen: boolean;
  isShuffled: boolean;
  repeatMode: RepeatMode;
  volume: number;
  setVolume: (value: number) => void;
  // Sortie audio (haut-parleurs, casque, sortie HDMI...). `""` = aucune
  // sélection explicite, on suit la sortie par défaut du système.
  outputDeviceId: string;
  // Rejette si le périphérique refuse d'être ouvert : l'appelant affiche
  // l'erreur plutôt que de laisser croire à un changement effectif.
  setOutputDevice: (deviceId: string) => Promise<void>;
  outputSwitchSupported: boolean;
  // `source` documente d'où vient cette playlist (recherche, classement,
  // album, playlist, artiste, favoris, historique...). Si la liste passée
  // est déjà celle en cours de lecture, on se contente de sauter au bon
  // morceau sans reconstruire la file (voir corps de la fonction).
  playQueue: (songs: PlayableSong[], startIndex?: number, source?: PlaySource) => void;
  enqueue: (song: PlayableSong) => void;
  /** Insère juste après le morceau en cours, sans toucher au reste de la file. */
  playNextInQueue: (song: PlayableSong) => void;
  /** Déplace un morceau dans la file (glisser-déposer). Indices dans `queue`. */
  reorderQueue: (from: number, to: number) => void;
  /** Retire un morceau de la file. La lecture en cours n'est interrompue que s'il s'agit du morceau joué. */
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  togglePlay: () => void;
  playNext: () => void;
  playPrevious: () => void;
  seek: (seconds: number) => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  /** Bass Boost — cinq niveaux, vrai traitement Web Audio (voir constants/bassBoost.ts). */
  bassBoost: NiveauBass;
  setBassBoost: (niveau: NiveauBass) => void;
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
  audioQuality: AudioQuality;
  setAudioQuality: (quality: AudioQuality) => void;
  /** Minuteur de veille : millisecondes restantes, ou null si inactif. */
  sleepRemainingMs: number | null;
  /** Vrai quand la lecture doit s'arrêter à la fin du morceau en cours. */
  sleepAfterTrack: boolean;
  setSleepTimer: (option: SleepOption) => void;
  openFullPlayer: () => void;
  closeFullPlayer: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

const PLAY_RECORD_THRESHOLD_SECONDS = 30;
const OUTPUT_DEVICE_KEY = "moziik-audio-output";
const BASS_BOOST_KEY = "moziik-bass-boost";
const PLAYBACK_RATE_KEY = "moziik-playback-rate";

// Mélange de Fisher-Yates, en gardant `keepFirst` (l'index en cours de
// lecture) en toute première position pour ne pas couper la piste actuelle.
function shuffledOrder(length: number, keepFirst: number): number[] {
  const rest = Array.from({ length }, (_, i) => i).filter((i) => i !== keepFirst);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [keepFirst, ...rest];
}

// Compare deux listes de morceaux par identifiant : sert à détecter si la
// playlist qu'on nous demande de jouer est déjà celle en cours, pour ne
// jamais reconstruire inutilement la file (règle n°3 du cahier des charges).
function isSameSongList(a: PlayableSong[], b: PlayableSong[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]._id !== b[i]._id) return false;
  }
  return true;
}

function deplacer<T>(liste: T[], de: number, vers: number): T[] {
  const copie = [...liste];
  const [item] = copie.splice(de, 1);
  copie.splice(vers, 0, item);
  return copie;
}

/**
 * Table « ancien index -> nouvel index » après un déplacement dans la
 * file. Nécessaire parce que l'ordre de lecture (`order`) est une
 * permutation d'index : déplacer un morceau dans `queue` sans remapper
 * `order` ferait sauter la lecture sur un autre titre.
 */
function tableDeplacement(taille: number, de: number, vers: number): number[] {
  const apres = deplacer(Array.from({ length: taille }, (_, i) => i), de, vers);
  const table = new Array<number>(taille);
  apres.forEach((ancien, nouveau) => {
    table[ancien] = nouveau;
  });
  return table;
}

function estNiveauBass(valeur: string | null): valeur is NiveauBass {
  return !!valeur && NIVEAUX_BASS.some((n) => n.id === valeur);
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const siteConfig = useSiteConfig();
  const {
    audioRef,
    ensureAudioGraph,
    setBassBoost: setEngineBassBoost,
    setPlaybackRate: setEnginePlaybackRate,
    setOutputDevice: setEngineOutputDevice,
    isOutputSwitchSupported,
  } = useAudioEngine();

  const [queue, setQueue] = useState<PlayableSong[]>([]);
  // `order` est une permutation des index de `queue` représentant l'ordre de
  // lecture réel (identité quand la lecture aléatoire est désactivée).
  // `position` pointe la place courante à l'intérieur de cet ordre.
  const [order, setOrder] = useState<number[]>([]);
  const [position, setPosition] = useState(0);
  const [playSource, setPlaySource] = useState<PlaySource>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [streamDuration, setStreamDuration] = useState(0);
  const [isFullPlayerOpen, setFullPlayerOpen] = useState(false);
  const cheminActuel = usePathname();

  /* Le lecteur plein écran se referme dès qu'on change de page.
     Il contient des liens — l'artiste, l'album, un titre similaire, une
     ligne de la file — qui naviguaient sous lui : la nouvelle page se
     chargeait derrière un calque opaque `fixed inset-0` toujours ouvert.
     On atterrissait donc sur une page qu'on ne voyait pas et qui ne
     réagissait à rien. Suivre le titre en cours n'a jamais imposé de
     rester dans le lecteur : le mini-lecteur prend le relais. */
  useEffect(() => {
    setFullPlayerOpen(false);
  }, [cheminActuel]);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [volume, setVolumeState] = useState(1);
  const [outputDeviceId, setOutputDeviceId] = useState("");
  const [outputSwitchSupported, setOutputSwitchSupported] = useState(false);
  const [bassBoost, setBassBoostState] = useState<NiveauBass>(NIVEAU_BASS_PAR_DEFAUT);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [audioQuality, setAudioQualityState] = useState<AudioQuality>("high");
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null);
  const [sleepRemainingMs, setSleepRemainingMs] = useState<number | null>(null);
  const [sleepAfterTrack, setSleepAfterTrack] = useState(false);
  const hasRecordedPlay = useRef(false);
  // Lu depuis le gestionnaire « ended », qui est posé une fois : sans ref,
  // il verrait toujours la valeur du premier rendu.
  const sleepAfterTrackRef = useRef(false);
  // Vraie durée du flux : celle enregistrée en base peut être fausse
  // (import automatique, conteneur sans en-tête de durée fiable).
  const currentIndex = order[position] ?? 0;
  const currentSong = queue[currentIndex] ?? null;

  // Volume persisté d'une session à l'autre.
  useEffect(() => {
    const stored = localStorage.getItem("moziik-volume");
    if (stored !== null) {
      const parsed = Number(stored);
      if (!Number.isNaN(parsed)) setVolumeState(parsed);
    }
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume, audioRef]);

  function setVolume(value: number) {
    const clamped = Math.min(1, Math.max(0, value));
    setVolumeState(clamped);
    localStorage.setItem("moziik-volume", String(clamped));
  }

  // Bass Boost et vitesse, restaurés au montage. Aucun AudioContext
  // n'existe encore : le moteur retient la valeur et l'applique au
  // démarrage de la première lecture (voir ensureAudioGraph).
  useEffect(() => {
    const niveau = localStorage.getItem(BASS_BOOST_KEY);
    if (estNiveauBass(niveau)) {
      setBassBoostState(niveau);
      setEngineBassBoost(niveau);
    }
    const rate = Number(localStorage.getItem(PLAYBACK_RATE_KEY));
    if (rate && rate >= 0.5 && rate <= 2) {
      setPlaybackRateState(rate);
      setEnginePlaybackRate(rate);
    }
    getOfflineSettings()
      .then((s) => setAudioQualityState(s.audioQuality))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setBassBoost(niveau: NiveauBass) {
    setBassBoostState(niveau);
    setEngineBassBoost(niveau);
    localStorage.setItem(BASS_BOOST_KEY, niveau);
  }

  function setPlaybackRate(rate: number) {
    setPlaybackRateState(rate);
    setEnginePlaybackRate(rate);
    localStorage.setItem(PLAYBACK_RATE_KEY, String(rate));
  }

  // Support calculé après montage : `window` n'existe pas au rendu serveur.
  useEffect(() => {
    setOutputSwitchSupported(isOutputSwitchSupported());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sortie mémorisée d'une session à l'autre.
  useEffect(() => {
    const stored = localStorage.getItem(OUTPUT_DEVICE_KEY);
    if (!stored) return;
    setOutputDeviceId(stored);
    setEngineOutputDevice(stored).catch(() => {
      // Périphérique disparu depuis : on revient à la sortie système.
      setOutputDeviceId("");
      localStorage.removeItem(OUTPUT_DEVICE_KEY);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setOutputDevice(deviceId: string) {
    if (!isOutputSwitchSupported()) {
      throw new Error("Ce navigateur ne permet pas de choisir la sortie audio.");
    }
    // L'état n'est mis à jour qu'après l'acceptation réelle du
    // périphérique : en cas d'échec, l'UI continue de désigner la sortie
    // qui joue effectivement.
    await setEngineOutputDevice(deviceId);
    setOutputDeviceId(deviceId);
    localStorage.setItem(OUTPUT_DEVICE_KEY, deviceId);
  }

  /**
   * URL réellement lue.
   *
   * La qualité choisie est une transformation Cloudinary appliquée à la
   * volée. Elle n'est PAS appliquée hors-ligne : le service worker range
   * les morceaux téléchargés sous l'URL exacte demandée au moment du
   * téléchargement — changer l'URL ferait manquer le cache et rendrait
   * muet un morceau pourtant disponible.
   */
  function sourceAudio(song: PlayableSong, quality: AudioQuality) {
    if (typeof navigator !== "undefined" && !navigator.onLine) return song.audioUrl;
    return applyAudioQuality(song.audioUrl, quality);
  }

  async function setAudioQuality(quality: AudioQuality) {
    setAudioQualityState(quality);
    await setOfflineSettings({ audioQuality: quality }).catch(() => undefined);

    // Recharge le flux à la nouvelle qualité sans perdre la position ni
    // l'état de lecture : sinon le morceau repart de zéro à chaque
    // changement de réglage.
    const audio = audioRef.current;
    if (!audio || !currentSong) return;
    const instant = audio.currentTime;
    const jouait = !audio.paused;
    audio.src = sourceAudio(currentSong, quality);
    audio.addEventListener(
      "loadedmetadata",
      () => {
        audio.currentTime = instant;
        if (jouait) audio.play().catch(() => undefined);
      },
      { once: true }
    );
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onLoaded = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setStreamDuration(audio.duration);
    };
    const onEnded = () => {
      // Minuteur « fin du morceau » : on s'arrête ici, sans enchaîner.
      if (sleepAfterTrackRef.current) {
        sleepAfterTrackRef.current = false;
        setSleepAfterTrack(false);
        setIsPlaying(false);
        return;
      }
      playNext();
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("durationchange", onLoaded);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("durationchange", onLoaded);
      audio.removeEventListener("ended", onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, order, position, repeatMode]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;
    const voulue = sourceAudio(currentSong, audioQuality);
    audio.src = voulue;
    audio.playbackRate = playbackRate;
    setStreamDuration(0);
    hasRecordedPlay.current = false;

    // La transformation de qualité peut échouer (Cloudinary indisponible,
    // format non transcodable) : on retombe alors une fois sur l'URL
    // d'origine plutôt que de laisser un morceau muet.
    const onError = () => {
      if (audio.src !== currentSong.audioUrl) {
        audio.src = currentSong.audioUrl;
        if (isPlaying) audio.play().catch(() => undefined);
      }
    };
    audio.addEventListener("error", onError);

    if (isPlaying) audio.play().catch(() => undefined);
    return () => audio.removeEventListener("error", onError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?._id]);

  useEffect(() => {
    if (progress >= PLAY_RECORD_THRESHOLD_SECONDS && !hasRecordedPlay.current && currentSong) {
      hasRecordedPlay.current = true;

      // Historique local (point 10 du cahier des charges hors-ligne) :
      // toujours écrit, en ligne comme hors-ligne.
      idbPut(STORES.history, {
        songId: currentSong._id,
        title: currentSong.title,
        artistName: currentSong.artist?.stageName ?? "Artiste supprimé",
        coverUrl: currentSong.coverUrl,
        audioUrl: currentSong.audioUrl,
        duration: currentSong.duration,
        artistId: currentSong.artist?._id ?? "",
        playedAt: Date.now(),
      }).catch(() => {});
      markOfflineSongPlayed(currentSong._id).catch(() => {});

      fetch(`/api/songs/${currentSong._id}/play`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secondsListened: progress, completed: true, device: "web" }),
      }).catch(() => {
        // Hors-ligne : on ne perd pas l'écoute, elle est rejouée à la reconnexion.
        enqueueSyncAction({
          type: "record_play",
          songId: currentSong._id,
          secondsListened: progress,
          completed: true,
        });
      });
    }
  }, [progress, currentSong]);

  // ---------- Minuteur de veille ----------

  useEffect(() => {
    if (sleepEndsAt === null) {
      setSleepRemainingMs(null);
      return;
    }
    function tick() {
      const restant = (sleepEndsAt as number) - Date.now();
      if (restant <= 0) {
        // Arrêt net, mais on garde la file et la position : reprendre la
        // lecture au réveil ne doit rien redemander à l'utilisateur.
        audioRef.current?.pause();
        setIsPlaying(false);
        setSleepEndsAt(null);
        setSleepRemainingMs(null);
        return;
      }
      setSleepRemainingMs(restant);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleepEndsAt]);

  function setSleepTimer(option: SleepOption) {
    if (option === null) {
      setSleepEndsAt(null);
      setSleepAfterTrack(false);
      sleepAfterTrackRef.current = false;
      return;
    }
    if (option === "track") {
      setSleepEndsAt(null);
      setSleepAfterTrack(true);
      sleepAfterTrackRef.current = true;
      return;
    }
    setSleepAfterTrack(false);
    sleepAfterTrackRef.current = false;
    setSleepEndsAt(Date.now() + option * 60_000);
  }

  // ---------- File d'attente ----------

  function playQueue(songs: PlayableSong[], startIndex = 0, source: PlaySource = null) {
    ensureAudioGraph();

    // La liste demandée est déjà la playlist active (ex : l'utilisateur
    // clique un autre titre dans les mêmes résultats de recherche) : on
    // saute juste au bon morceau, sans reconstruire la file ni relancer un
    // nouveau mélange aléatoire.
    if (isSameSongList(songs, queue)) {
      const targetPosition = order.indexOf(startIndex);
      setPosition(targetPosition !== -1 ? targetPosition : 0);
      setIsPlaying(true);
      if (source) setPlaySource(source);
      return;
    }

    // Nouvelle playlist (nouvelle recherche, autre album, autre écran...) :
    // elle remplace entièrement la file active et devient la nouvelle
    // source de vérité pour Suivant / Précédent / lecture automatique.
    setQueue(songs);
    const initialOrder = isShuffled ? shuffledOrder(songs.length, startIndex) : songs.map((_, i) => i);
    setOrder(initialOrder);
    setPosition(initialOrder.indexOf(startIndex));
    setIsPlaying(true);
    setPlaySource(source);
  }

  function enqueue(song: PlayableSong) {
    if (queue.length === 0) {
      playQueue([song], 0, { type: "queue" });
      return;
    }
    setQueue((prev) => [...prev, song]);
    setOrder((prev) => [...prev, queue.length]);
  }

  function playNextInQueue(song: PlayableSong) {
    if (queue.length === 0) {
      playQueue([song], 0, { type: "queue" });
      return;
    }
    const insertion = currentIndex + 1;
    setQueue((prev) => {
      const copie = [...prev];
      copie.splice(insertion, 0, song);
      return copie;
    });
    // Tous les index >= insertion se décalent d'un cran ; le nouveau
    // morceau prend la place juste après celle en cours dans l'ordre.
    setOrder((prev) => {
      const remappe = prev.map((i) => (i >= insertion ? i + 1 : i));
      const apres = [...remappe];
      apres.splice(position + 1, 0, insertion);
      return apres;
    });
  }

  function reorderQueue(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= queue.length || to >= queue.length) return;
    const table = tableDeplacement(queue.length, from, to);
    setQueue((prev) => deplacer(prev, from, to));
    setOrder((prev) => prev.map((i) => table[i]));
  }

  function removeFromQueue(index: number) {
    if (index < 0 || index >= queue.length) return;
    if (queue.length === 1) {
      clearQueue();
      return;
    }
    const positionDansOrdre = order.indexOf(index);
    const etaitCourant = index === currentIndex;

    const nouvelOrdre = order
      .filter((i) => i !== index)
      .map((i) => (i > index ? i - 1 : i));

    setQueue((prev) => prev.filter((_, i) => i !== index));
    setOrder(nouvelOrdre);

    // La position doit continuer de désigner le même morceau — sauf si
    // c'est lui qu'on vient de retirer, auquel cas on enchaîne sur le
    // suivant (donc la même place dans l'ordre, ramenée dans les bornes).
    setPosition((prev) => {
      if (etaitCourant) return Math.min(prev, nouvelOrdre.length - 1);
      return positionDansOrdre < prev ? prev - 1 : prev;
    });
  }

  function clearQueue() {
    audioRef.current?.pause();
    setQueue([]);
    setOrder([]);
    setPosition(0);
    setIsPlaying(false);
    setProgress(0);
    setPlaySource(null);
  }

  function togglePlay() {
    ensureAudioGraph();
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => undefined);
    }
    setIsPlaying(!isPlaying);
  }

  function playNext() {
    const audio = audioRef.current;
    if (repeatMode === "one" && audio) {
      audio.currentTime = 0;
      setProgress(0);
      audio.play().catch(() => undefined);
      setIsPlaying(true);
      return;
    }
    if (position < order.length - 1) {
      setPosition(position + 1);
      setIsPlaying(true);
    } else if (repeatMode === "all" && order.length > 0) {
      setPosition(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }

  function playPrevious() {
    // Comme sur la plupart des lecteurs : si on a déjà avancé dans le
    // morceau, "précédent" revient d'abord au début de celui-ci.
    if (progress > 3) {
      seek(0);
      return;
    }
    if (position > 0) {
      setPosition(position - 1);
      setIsPlaying(true);
    } else if (repeatMode === "all" && order.length > 0) {
      setPosition(order.length - 1);
      setIsPlaying(true);
    }
  }

  function seek(seconds: number) {
    if (audioRef.current) audioRef.current.currentTime = seconds;
    setProgress(seconds);
  }

  function toggleShuffle() {
    if (!isShuffled) {
      setOrder(shuffledOrder(queue.length, currentIndex));
      setPosition(0);
    } else {
      setOrder(queue.map((_, i) => i));
      setPosition(currentIndex);
    }
    setIsShuffled(!isShuffled);
  }

  function cycleRepeatMode() {
    setRepeatMode((prev) => (prev === "off" ? "all" : prev === "all" ? "one" : "off"));
  }

  // Métadonnées "en cours de lecture" : titre de l'onglet, favicon (pochette
  // du son), et Media Session (contrôles système / écran de verrouillage,
  // notification média sur mobile).
  const originalFavicons = useRef<{ el: HTMLLinkElement; href: string }[] | null>(null);
  const originalTitle = useRef<string | null>(null);

  useEffect(() => {
    if (originalTitle.current === null) originalTitle.current = document.title;

    const faviconLinks = Array.from(document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']"));
    if (originalFavicons.current === null && faviconLinks.length > 0) {
      originalFavicons.current = faviconLinks.map((el) => ({ el, href: el.href }));
    }

    if (currentSong) {
      document.title = `${currentSong.title} — ${currentSong.artist?.stageName ?? "Artiste supprimé"}`;
      faviconLinks.forEach((link) => (link.href = currentSong.coverUrl));
    } else {
      document.title = originalTitle.current ?? siteConfig.siteName;
      originalFavicons.current?.forEach(({ el, href }) => (el.href = href));
    }
  }, [currentSong, siteConfig.siteName]);

  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentSong) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title,
      artist: currentSong.artist?.stageName ?? "Artiste supprimé",
      album:
        typeof currentSong.album === "object" && currentSong.album ? currentSong.album.title : siteConfig.siteName,
      artwork: [
        { src: currentSong.coverUrl, sizes: "96x96", type: "image/png" },
        { src: currentSong.coverUrl, sizes: "256x256", type: "image/png" },
        { src: currentSong.coverUrl, sizes: "512x512", type: "image/png" },
      ],
    });
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

    navigator.mediaSession.setActionHandler("play", togglePlay);
    navigator.mediaSession.setActionHandler("pause", togglePlay);
    navigator.mediaSession.setActionHandler("previoustrack", playPrevious);
    navigator.mediaSession.setActionHandler("nexttrack", playNext);
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime !== undefined) seek(details.seekTime);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong, isPlaying]);

  const duration = streamDuration || currentSong?.duration || 0;

  return (
    <PlayerContext.Provider
      value={{
        queue,
        currentSong,
        currentPlaylist: queue,
        currentTrack: currentSong,
        currentIndex,
        playSource,
        isPlaying,
        progress,
        duration,
        isFullPlayerOpen,
        isShuffled,
        repeatMode,
        volume,
        setVolume,
        outputDeviceId,
        setOutputDevice,
        outputSwitchSupported,
        playQueue,
        enqueue,
        playNextInQueue,
        reorderQueue,
        removeFromQueue,
        clearQueue,
        togglePlay,
        playNext,
        playPrevious,
        seek,
        toggleShuffle,
        cycleRepeatMode,
        bassBoost,
        setBassBoost,
        playbackRate,
        setPlaybackRate,
        audioQuality,
        setAudioQuality,
        sleepRemainingMs,
        sleepAfterTrack,
        setSleepTimer,
        openFullPlayer: () => setFullPlayerOpen(true),
        closeFullPlayer: () => setFullPlayerOpen(false),
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer doit être utilisé sous PlayerProvider.");
  return ctx;
}
