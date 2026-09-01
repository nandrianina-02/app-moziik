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
import { marquerJoue } from "@/lib/journalDuJour";
import { idbPut, STORES } from "@/lib/offlineDb";
import { enqueueSyncAction } from "@/lib/syncQueue";
import {
  applyAudioQuality,
  getOfflineSettings,
  setOfflineSettings,
  type AudioQuality,
} from "@/lib/offlineSettings";
import { useSiteConfig } from "@/context/SiteConfigProvider";
import { useOnlineStatus } from "@/context/OnlineStatusProvider";
import { useUnivers } from "@/context/UniversProvider";
import { useAcces } from "@/context/AccesProvider";
import { limiterQualite, MESSAGE_QUOTA_ANONYME } from "@/lib/acces";
import { useMode } from "@/context/ModeProvider";
import { morceauxSuivants } from "@/lib/playbackContinuation";

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
  | "queue"
  /** Bibliothèque hors-ligne : se prolonge sans jamais toucher au réseau. */
  | "downloads";

export type PlaySource = {
  type: PlaySourceType;
  label?: string;
  /**
   * Identifiant de la source quand elle en a un — artiste, album,
   * playlist. Sans lui, le prolongement ne saurait pas quoi demander au
   * serveur une fois la file épuisée.
   */
  id?: string;
  /** Termes saisis, pour prolonger une file issue de la recherche. */
  query?: string;
  /** Genre de la station, pour prolonger une file de radio. */
  genre?: string;
  /**
   * Station personnalisée : sa suite se demande à /api/station, qui
   * connaît le profil de l'auditeur, et non à un filtre de catalogue.
   * Sans ce marqueur, elle se prolongerait par les plus écoutés — et
   * cesserait d'être personnalisée au bout de vingt titres.
   */
  station?: boolean;
} | null;

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
  /** Titres en réserve, prêts à rejoindre la file par lots de dix. */
  reserveCount: number;
  /** Vrai pendant qu'on cherche de quoi prolonger la file. */
  chargementSuite: boolean;
  /** Vrai dès que la file a été prolongée au-delà de ce qui avait été demandé. */
  lectureProlongee: boolean;
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
  /**
   * Le visiteur non connecté a épuisé son quota d'écoute du jour.
   *
   * Exposé plutôt que traité sur place : c'est l'interface qui décide
   * comment le dire, le lecteur se contente d'arrêter le son.
   */
  quotaEpuise: boolean;
  /** Referme le mur — après une connexion, ou si le visiteur l'écarte. */
  ignorerQuota: () => void;
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

/**
 * La file se remplit par lots de dix, jamais d'un seul bloc.
 *
 * Une playlist de deux cents titres n'a aucune raison d'être chargée
 * entièrement dans la file : on en met dix devant l'auditeur, le reste
 * attend en réserve. Dès qu'il ne reste que trois titres à jouer, le lot
 * suivant est préparé — donc bien avant la fin du dernier, ce qui laisse
 * l'enchaînement se faire sans silence. Quand la réserve est vide, c'est le
 * prolongement (lib/playbackContinuation) qui la remplit à son tour.
 */
const TAILLE_LOT = 10;
const SEUIL_RECHARGE = 3;

/**
 * Les morceaux joués quittent la file. Ils ne disparaissent pas pour autant :
 * ils rejoignent cet historique, qui alimente le bouton « précédent » et
 * évite qu'un prolongement les resserve.
 */
const TAILLE_HISTORIQUE = 30;

/**
 * Reprise d'une écoute d'une session à l'autre. Deux clés plutôt qu'une : la
 * file ne change qu'à chaque morceau, la position toutes les cinq secondes —
 * les écrire ensemble ferait réécrire la file entière en permanence.
 */
const REPRISE_FILE_KEY = "moziik-lecture-file";
const REPRISE_POSITION_KEY = "moziik-lecture-position";
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

/**
 * Tire `combien` éléments au hasard dans une liste, et rend aussi ce qui
 * reste. En lecture aléatoire, c'est ainsi que se compose un lot : le hasard
 * porte sur toute la réserve, pas seulement sur les dix titres chargés — sans
 * quoi « aléatoire » ne brasserait qu'une fenêtre glissante de dix morceaux.
 */
function tirerAuHasard<T>(liste: T[], combien: number): { pris: T[]; reste: T[] } {
  const reste = [...liste];
  const pris: T[] = [];
  while (pris.length < combien && reste.length > 0) {
    const [element] = reste.splice(Math.floor(Math.random() * reste.length), 1);
    pris.push(element);
  }
  return { pris, reste };
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
  // Ce qui attend derrière la file : le reste de la liste demandée, puis les
  // prolongements. Sert les lots de dix, dans l'ordre ou au hasard.
  const [reserve, setReserve] = useState<PlayableSong[]>([]);
  // Morceaux déjà joués, retirés de la file. Le plus récent est en dernier.
  const [historique, setHistorique] = useState<PlayableSong[]>([]);
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
  const [chargementSuite, setChargementSuite] = useState(false);
  const [lectureProlongee, setLectureProlongee] = useState(false);
  const { isOnline } = useOnlineStatus();
  const { univers } = useUnivers();
  const { mode } = useMode();
  const hasRecordedPlay = useRef(false);
  // Lu depuis le gestionnaire « ended », qui est posé une fois : sans ref,
  // il verrait toujours la valeur du premier rendu.
  const sleepAfterTrackRef = useRef(false);
  /**
   * La lecture est-elle encore voulue ?
   *
   * Le prolongement dure le temps d'un aller-retour réseau. Une mise en
   * pause ou un minuteur de veille qui expire pendant ce laps de temps
   * arrivent avant la réponse : sans ce drapeau, la suite serait quand
   * même lancée et le lecteur repartirait tout seul après un arrêt
   * explicite.
   */
  const lectureVoulueRef = useRef(false);
  // Vraie durée du flux : celle enregistrée en base peut être fausse
  // (import automatique, conteneur sans en-tête de durée fiable).
  const currentIndex = order[position] ?? 0;
  const currentSong = queue[currentIndex] ?? null;

  // Ce que le visiteur a le droit d'écouter, et en quelle qualité.
  const acces = useAcces();
  /** Le quota de visiteur est épuisé : la lecture s'arrête là. */
  const [quotaEpuise, setQuotaEpuise] = useState(false);

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
    // Le plafond s'applique ici, sur l'URL réellement lue, et pas
    // seulement dans le menu de réglage : un compte gratuit qui aurait
    // choisi « 320 » avant de perdre son abonnement retombe à 128.
    return applyAudioQuality(song.audioUrl, limiterQualite(quality, acces));
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
        lectureVoulueRef.current = false;
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
  }, [queue, order, position, repeatMode, reserve]);

  /**
   * Le quota des visiteurs non connectés, vérifié avant chaque nouveau
   * titre.
   *
   * Le décompte est tenu par le serveur, à partir de l'adresse IP : un
   * compteur rangé dans le navigateur se remet à zéro en effaçant les
   * données du site, ce qui revenait à ne rien limiter.
   */
  useEffect(() => {
    if (acces.chargement || acces.connecte || !currentSong) return;

    let annule = false;
    fetch("/api/ecoute/quota", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songId: currentSong._id }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (annule || !data || data.autorise) return;
        setQuotaEpuise(true);
        lectureVoulueRef.current = false;
        setIsPlaying(false);
        audioRef.current?.pause();
      })
      // Le serveur injoignable ne doit pas couper l'écoute : on laisse
      // passer plutôt que de punir une panne réseau.
      .catch(() => undefined);

    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?._id, acces.connecte, acces.chargement]);

  // Se connecter lève le mur sans recharger la page.
  useEffect(() => {
    if (acces.connecte) setQuotaEpuise(false);
  }, [acces.connecte]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;
    const voulue = sourceAudio(currentSong, audioQuality);
    audio.src = voulue;
    audio.playbackRate = playbackRate;
    setStreamDuration(0);
    hasRecordedPlay.current = false;

    // Reprise d'une écoute interrompue : la position ne peut être posée
    // qu'une fois les métadonnées lues — avant, le navigateur l'ignore
    // silencieusement et le morceau repart de zéro.
    const reprise = repriseRef.current;
    repriseRef.current = null;
    if (reprise !== null && reprise > 0) {
      // L'écoute a déjà été comptée à la session précédente si le seuil était
      // franchi : la reprendre ne doit pas la compter une deuxième fois.
      hasRecordedPlay.current = reprise >= PLAY_RECORD_THRESHOLD_SECONDS;
      const poserPosition = () => {
        audio.currentTime = reprise;
        setProgress(reprise);
      };
      if (audio.readyState >= 1) poserPosition();
      else audio.addEventListener("loadedmetadata", poserPosition, { once: true });
    }

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

      // Le journal du jour se remplit ici, au même seuil que tout le
      // reste : ce qui compte comme une écoute pour les statistiques
      // compte comme une écoute pour la répétition. Un titre sauté au
      // bout de trois secondes n'y entre pas et pourra revenir.
      marquerJoue(currentSong._id);

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
        lectureVoulueRef.current = false;
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

  // ---------- Prolongement de la file ----------

  /**
   * Photographie de l'état courant, relue par le prolongement.
   *
   * Il est asynchrone et démarré depuis le gestionnaire « ended » : entre
   * le moment où il part et celui où la réponse arrive, l'auditeur a pu
   * changer de file. Sans ref, on écrirait la suite d'une lecture qui
   * n'existe plus.
   */
  const etatRef = useRef({ queue, order, playSource, currentSong, isOnline, reserve, historique });
  useEffect(() => {
    etatRef.current = { queue, order, playSource, currentSong, isOnline, reserve, historique };
    // Un lot par rendu au maximum : le drapeau est levé le temps d'une
    // fournée et retombe ici. Sans cela, l'effet d'approvisionnement pourrait
    // servir deux lots à partir de la même photographie de la file et
    // calculer les mêmes index deux fois.
    lotEnCoursRef.current = false;
  });

  const lotEnCoursRef = useRef(false);
  /** La lecture est arrivée au bout de la file et attend le lot suivant. */
  const attenteSuiteRef = useRef(false);
  /** Seconde à laquelle reprendre le morceau restauré, une seule fois. */
  const repriseRef = useRef<number | null>(null);

  /** Tours déjà servis et échecs consécutifs, pour cette file. */
  const prolongementRef = useRef({ tour: 0, echecs: 0, enCours: false });

  function reinitialiserProlongement() {
    prolongementRef.current = { tour: 0, echecs: 0, enCours: false };
    setLectureProlongee(false);
  }

  /**
   * Cherche la suite auprès de la source et la range en réserve. Renvoie
   * false quand le catalogue n'a plus rien à offrir — c'est le seul cas où
   * la lecture s'arrête vraiment.
   *
   * Elle ne touche ni à la file ni à la position : c'est l'effet
   * d'approvisionnement qui décide quand servir le lot suivant.
   */
  async function remplirReserve(): Promise<boolean> {
    const etat = prolongementRef.current;
    const {
      queue: fileActuelle,
      playSource: source,
      currentSong: dernier,
      reserve: reserveActuelle,
      historique: dejaJoues,
    } = etatRef.current;
    if (etat.enCours || fileActuelle.length === 0) return false;
    // Deux tours sans rien trouver : le catalogue n'a plus rien pour cette
    // source. Insister enchaînerait des requêtes vides à chaque fin de
    // morceau.
    if (etat.echecs >= 2) return false;

    etat.enCours = true;
    setChargementSuite(true);
    try {
      const suite = await morceauxSuivants({
        source,
        dernier,
        // Les morceaux déjà joués ont quitté la file : sans l'historique,
        // le prolongement les resservirait aussitôt.
        dejaVus: new Set([...fileActuelle, ...reserveActuelle, ...dejaJoues].map((s) => s._id)),
        enLigne: etatRef.current.isOnline,
        tour: etat.tour,
      });
      if (suite.length === 0) {
        etat.echecs += 1;
        return false;
      }
      // Pause ou minuteur pendant la requête : on jette la réponse plutôt
      // que de garnir une file que plus personne n'attend.
      if (!lectureVoulueRef.current) return false;
      etat.tour += 1;
      etat.echecs = 0;

      setReserve((prev) => [...prev, ...suite]);
      setLectureProlongee(true);
      return true;
    } finally {
      etat.enCours = false;
      setChargementSuite(false);
    }
  }

  /**
   * Fait passer le lot suivant de la réserve à la file. En lecture
   * aléatoire, le lot est tiré au hasard dans toute la réserve.
   */
  function servirLot() {
    const { queue: fileActuelle, reserve: disponible } = etatRef.current;
    if (disponible.length === 0 || lotEnCoursRef.current) return;
    lotEnCoursRef.current = true;

    const { pris, reste } = isShuffled
      ? tirerAuHasard(disponible, TAILLE_LOT)
      : { pris: disponible.slice(0, TAILLE_LOT), reste: disponible.slice(TAILLE_LOT) };

    const debut = fileActuelle.length;
    setReserve(reste);
    setQueue((prev) => [...prev, ...pris]);
    setOrder((prev) => [...prev, ...pris.map((_, i) => debut + i)]);
  }

  // ---------- File d'attente ----------

  function playQueue(songs: PlayableSong[], startIndex = 0, source: PlaySource = null) {
    if (songs.length === 0) return;
    ensureAudioGraph();

    // Un index hors bornes viderait la file : le lot se compose à partir du
    // morceau demandé, il faut donc qu'un morceau soit désigné.
    const depart = Math.min(Math.max(0, startIndex), songs.length - 1);

    // La liste demandée est déjà la playlist active (ex : l'utilisateur
    // clique un autre titre dans les mêmes résultats de recherche) : on
    // saute juste au bon morceau, sans reconstruire la file ni relancer un
    // nouveau mélange aléatoire.
    lectureVoulueRef.current = true;

    if (isSameSongList(songs, queue)) {
      const targetPosition = order.indexOf(depart);
      setPosition(targetPosition !== -1 ? targetPosition : 0);
      setIsPlaying(true);
      if (source) setPlaySource(source);
      return;
    }

    // Nouvelle playlist (nouvelle recherche, autre album, autre écran...) :
    // elle remplace entièrement la file active et devient la nouvelle
    // source de vérité pour Suivant / Précédent / lecture automatique.
    //
    // Elle n'y entre pas d'un bloc : le morceau demandé et les neuf suivants
    // forment le premier lot, le reste attend en réserve. Ce qui précédait le
    // morceau demandé n'est pas perdu — il rejoint l'historique, d'où le
    // bouton « précédent » sait le ramener.
    reinitialiserProlongement();
    const aVenir = songs.slice(depart);
    const { pris: premierLot, reste } = isShuffled
      ? (() => {
          // Le morceau cliqué reste le premier : c'est lui qu'on a demandé.
          const tirage = tirerAuHasard(aVenir.slice(1), TAILLE_LOT - 1);
          return { pris: [aVenir[0], ...tirage.pris], reste: tirage.reste };
        })()
      : { pris: aVenir.slice(0, TAILLE_LOT), reste: aVenir.slice(TAILLE_LOT) };

    setQueue(premierLot);
    setReserve(reste);
    setHistorique(songs.slice(0, depart).slice(-TAILLE_HISTORIQUE));
    setOrder(premierLot.map((_, i) => i));
    setPosition(0);
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

  /**
   * Retire de la file le morceau qui vient d'être joué et le range dans
   * l'historique. La place courante ne bouge pas : l'entrée disparue étant
   * exactement celle qu'elle désignait, elle pointe désormais le morceau
   * suivant.
   */
  function consommerCourant() {
    const index = currentIndex;
    const morceau = queue[index];
    if (!morceau) return;

    setHistorique((prev) => [...prev, morceau].slice(-TAILLE_HISTORIQUE));
    const nouvelOrdre = order.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i));
    setQueue((prev) => prev.filter((_, i) => i !== index));
    setOrder(nouvelOrdre);
    setPosition((prev) => Math.min(prev, Math.max(0, nouvelOrdre.length - 1)));
  }

  /**
   * Passe au morceau suivant de l'ordre.
   *
   * En répétition intégrale, rien n'est retiré : la file doit pouvoir
   * reboucler sur ce qu'elle contient. Partout ailleurs, ce qu'on quitte
   * quitte la file.
   */
  function avancerDUnCran() {
    if (repeatMode !== "all" && order.length > 1) consommerCourant();
    else setPosition((prev) => Math.min(prev + 1, order.length - 1));
    setIsPlaying(true);
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

  /**
   * Changer d'univers ou de mode change la SUITE, pas ce qui joue.
   *
   * Couper le morceau en cours pour appliquer un réglage serait le plus
   * mauvais moment de le faire, et la file que l'auditeur a lancée lui-même
   * — un album, une playlist — reste la sienne : il l'a demandée, elle ne
   * lui est pas imposée par un algorithme.
   *
   * Ce qui part, c'est la réserve : des morceaux déjà téléchargés du
   * répertoire précédent, que rien ne signale à l'écran et qui se
   * mettraient à jouer d'eux-mêmes dix minutes plus tard. Le prochain
   * prolongement les remplace par des titres du bon univers — les routes
   * lisent le cookie, qui vient de changer.
   */
  useEffect(() => {
    setReserve([]);
    prolongementRef.current = { tour: 0, echecs: 0, enCours: false };
    // Premier rendu compris : la réserve y est déjà vide, l'effet ne coûte
    // rien et il évite d'avoir à distinguer le montage d'une bascule.
    //
    // Le mode compte autant que l'univers : passer en « Sommeil » à
    // vingt-trois heures ne doit pas laisser jouer dix titres de fête déjà
    // téléchargés, que rien à l'écran ne signale.
  }, [univers, mode]);

  function clearQueue() {
    reinitialiserProlongement();
    lectureVoulueRef.current = false;
    attenteSuiteRef.current = false;
    audioRef.current?.pause();
    setQueue([]);
    setReserve([]);
    setHistorique([]);
    setOrder([]);
    setPosition(0);
    setIsPlaying(false);
    setProgress(0);
    setPlaySource(null);
    // Vider la file, c'est aussi renoncer à la reprise : au prochain
    // démarrage, le lecteur doit être vide comme on l'a laissé.
    try {
      localStorage.removeItem(REPRISE_FILE_KEY);
      localStorage.removeItem(REPRISE_POSITION_KEY);
    } catch {
      // Stockage indisponible (navigation privée stricte) : sans effet.
    }
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
    lectureVoulueRef.current = !isPlaying;
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
      avancerDUnCran();
      return;
    }
    // Bout de la file, mais la réserve n'est pas vide : l'effet
    // d'approvisionnement sert le lot suivant, et la lecture enchaîne dès
    // qu'il est là (voir `attenteSuiteRef`).
    if (reserve.length > 0) {
      lectureVoulueRef.current = true;
      attenteSuiteRef.current = true;
      setIsPlaying(true);
      // Servi ici et pas seulement par l'effet : lever le drapeau ne change
      // aucun état, l'effet ne se rejouerait donc pas et la lecture
      // attendrait un lot que personne n'aurait servi.
      servirLot();
      return;
    }
    if (repeatMode === "all" && order.length > 0) {
      setPosition(0);
      setIsPlaying(true);
      return;
    }
    // Plus rien nulle part : on va chercher la suite auprès de la source qui
    // a lancé la lecture. `isPlaying` reste vrai pendant la recherche — le
    // lecteur affiche un chargement au lieu de clignoter sur « en pause »
    // puis de repartir.
    lectureVoulueRef.current = true;
    attenteSuiteRef.current = true;
    void remplirReserve().then((prolonge) => {
      if (!prolonge) {
        attenteSuiteRef.current = false;
        setIsPlaying(false);
      }
    });
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
      return;
    }

    // Les morceaux joués ne sont plus dans la file : on va rechercher le
    // dernier dans l'historique et on le réinsère juste devant le morceau en
    // cours, pour que « précédent » reste « précédent ».
    const precedent = historique[historique.length - 1];
    if (precedent) {
      const insertion = currentIndex;
      setHistorique((prev) => prev.slice(0, -1));
      setQueue((prev) => {
        const copie = [...prev];
        copie.splice(insertion, 0, precedent);
        return copie;
      });
      setOrder((prev) => {
        const remappe = prev.map((i) => (i >= insertion ? i + 1 : i));
        const apres = [...remappe];
        apres.splice(position, 0, insertion);
        return apres;
      });
      setIsPlaying(true);
      return;
    }

    if (repeatMode === "all" && order.length > 0) {
      setPosition(order.length - 1);
      setIsPlaying(true);
    }
  }

  function seek(seconds: number) {
    if (audioRef.current) audioRef.current.currentTime = seconds;
    setProgress(seconds);
  }

  function toggleShuffle() {
    // L'ordre ne porte que sur le lot chargé ; la réserve, elle, garde
    // l'ordre de la liste d'origine et c'est le tirage des lots suivants qui
    // devient aléatoire. Le hasard couvre ainsi toute la playlist, et le
    // désactiver la rend intacte.
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

  // ---------- Approvisionnement de la file ----------

  /**
   * Garde toujours quelques titres devant l'auditeur.
   *
   * Attendre la fin du dernier morceau pour aller chercher la suite laissait
   * un silence le temps de l'aller-retour réseau. Ici le lot suivant est
   * préparé dès qu'il ne reste que trois titres à jouer : quand la fin
   * arrive, ce qui suit est déjà là.
   */
  useEffect(() => {
    const restants = order.length - position - 1;

    // Le lot attendu vient d'arriver : la lecture reprend son cours.
    if (attenteSuiteRef.current && restants > 0) {
      attenteSuiteRef.current = false;
      // Une pause pendant l'attente du lot vaut refus : son arrivée ne doit
      // pas relancer une lecture qu'on vient d'arrêter.
      if (lectureVoulueRef.current) avancerDUnCran();
      return;
    }

    if (queue.length === 0 || restants >= SEUIL_RECHARGE) return;

    if (reserve.length > 0) {
      servirLot();
      return;
    }

    // Réserve vide : on demande la suite à la source. Seulement si une
    // lecture est en cours — un lecteur en pause n'a aucune raison de
    // continuer à grossir tout seul.
    if (lectureVoulueRef.current) void remplirReserve();
    // `queue` et `order` entiers plutôt que leurs longueurs : l'avance retire un
    // morceau et remappe l'ordre, deux changements qu'une longueur ne voit pas
    // toujours passer, et le gestionnaire refermerait alors sur un état périmé.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, order, position, reserve]);

  // ---------- Reprise d'une session à l'autre ----------

  /**
   * Restaure la dernière écoute au montage : le morceau revient dans la barre
   * de lecture, à l'arrêt, à la seconde où on l'avait laissé. Rien ne
   * redémarre tout seul — la lecture reprend au premier appui sur « lire ».
   */
  useEffect(() => {
    try {
      const brutFile = localStorage.getItem(REPRISE_FILE_KEY);
      if (!brutFile) return;
      const sauvegarde = JSON.parse(brutFile) as {
        queue?: PlayableSong[];
        order?: number[];
        position?: number;
        source?: PlaySource;
      };

      // Une sauvegarde peut dater d'une version antérieure du format : on ne
      // garde que ce qui est réellement jouable.
      const fileSauvee = (sauvegarde.queue ?? []).filter(
        (s) => !!s && typeof s._id === "string" && typeof s.audioUrl === "string" && s.audioUrl.length > 0
      );
      if (fileSauvee.length === 0) return;

      const ordre =
        Array.isArray(sauvegarde.order) && sauvegarde.order.length === fileSauvee.length
          ? sauvegarde.order
          : fileSauvee.map((_, i) => i);
      const place = Math.min(Math.max(0, sauvegarde.position ?? 0), ordre.length - 1);

      setQueue(fileSauvee);
      setOrder(ordre);
      setPosition(place);
      setPlaySource(sauvegarde.source ?? null);

      const brutPosition = localStorage.getItem(REPRISE_POSITION_KEY);
      const marque = brutPosition ? (JSON.parse(brutPosition) as { songId?: string; seconds?: number }) : null;
      const morceau = fileSauvee[ordre[place]];
      if (!morceau || marque?.songId !== morceau._id || typeof marque?.seconds !== "number") return;

      // Une reprise à trois secondes de la fin ne rend service à personne, pas
      // plus qu'une reprise à la première seconde.
      const duree = morceau.duration ?? 0;
      if (marque.seconds <= 1 || (duree > 0 && marque.seconds >= duree - 5)) return;

      repriseRef.current = marque.seconds;
      setProgress(marque.seconds);
    } catch {
      // Sauvegarde illisible : on repart d'un lecteur vide plutôt que de
      // laisser une donnée corrompue empêcher toute lecture.
      localStorage.removeItem(REPRISE_FILE_KEY);
      localStorage.removeItem(REPRISE_POSITION_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** La file : courte (un lot), écrite seulement quand elle change. */
  useEffect(() => {
    if (queue.length === 0) return;
    try {
      // Les paroles sont retirées avant l'écriture : elles pèsent parfois
      // plus que tout le reste de la file, et le lecteur les redemande de
      // toute façon morceau par morceau (useSongDetails).
      const allegee = queue.map(({ lyrics: _paroles, ...reste }) => reste);
      localStorage.setItem(REPRISE_FILE_KEY, JSON.stringify({ queue: allegee, order, position, source: playSource }));
    } catch {
      // Quota atteint ou stockage refusé : la reprise sera simplement absente.
    }
  }, [queue, order, position, playSource]);

  /**
   * La position : écrite toutes les cinq secondes d'écoute, et à chaque
   * pause. `progress` change quatre fois par seconde — l'arrondi évite
   * d'écrire autant de fois dans le stockage local.
   */
  const marqueSecondes = Math.floor(progress / 5);
  useEffect(() => {
    if (!currentSong) return;
    try {
      localStorage.setItem(REPRISE_POSITION_KEY, JSON.stringify({ songId: currentSong._id, seconds: progress }));
    } catch {
      // Voir ci-dessus : sans stockage, on perd la reprise, pas la lecture.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?._id, marqueSecondes, isPlaying]);

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
        reserveCount: reserve.length,
        chargementSuite,
        lectureProlongee,
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
        quotaEpuise,
        ignorerQuota: () => setQuotaEpuise(false),
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
