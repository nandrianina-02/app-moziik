"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAudioEngine } from "@/components/player/hooks/useAudioEngine";
import { markOfflineSongPlayed } from "@/lib/offlineCache";
import { idbPut, STORES } from "@/lib/offlineDb";
import { enqueueSyncAction } from "@/lib/syncQueue";
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
  togglePlay: () => void;
  playNext: () => void;
  playPrevious: () => void;
  seek: (seconds: number) => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  setBandGain: (index: number, gainDb: number) => void;
  applyPreset: (gains: number[]) => void;
  bassBoostPercent: number;
  setBassBoost: (percent: number) => void;
  openFullPlayer: () => void;
  closeFullPlayer: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

const PLAY_RECORD_THRESHOLD_SECONDS = 30;
const OUTPUT_DEVICE_KEY = "moziik-audio-output";

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

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const siteConfig = useSiteConfig();
  const {
    audioRef,
    ensureAudioGraph,
    setBandGain,
    applyPreset,
    setBassBoost: setEngineBassBoost,
    setOutputDevice: setEngineOutputDevice,
    isOutputSwitchSupported,
  } = useAudioEngine();
  const [bassBoostPercent, setBassBoostPercent] = useState(0);
  function setBassBoost(percent: number) {
    setBassBoostPercent(percent);
    setEngineBassBoost(percent);
  }
  const [queue, setQueue] = useState<PlayableSong[]>([]);
  // `order` est une permutation des index de `queue` représentant l'ordre de
  // lecture réel (identité quand la lecture aléatoire est désactivée).
  // `position` pointe la place courante à l'intérieur de cet ordre.
  const [order, setOrder] = useState<number[]>([]);
  const [position, setPosition] = useState(0);
  const [playSource, setPlaySource] = useState<PlaySource>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isFullPlayerOpen, setFullPlayerOpen] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [volume, setVolumeState] = useState(1);
  const [outputDeviceId, setOutputDeviceId] = useState("");
  const [outputSwitchSupported, setOutputSwitchSupported] = useState(false);
  const hasRecordedPlay = useRef(false);

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

  // Support calculé après montage : `window` n'existe pas au rendu serveur.
  useEffect(() => {
    setOutputSwitchSupported(isOutputSwitchSupported());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sortie mémorisée d'une session à l'autre. Aucun AudioContext n'existe
  // encore à ce stade : le moteur retient la valeur et l'applique au
  // démarrage de la première lecture (voir ensureAudioGraph).
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

  const currentIndex = order[position] ?? 0;
  const currentSong = queue[currentIndex] ?? null;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onEnded = () => playNext();

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, order, position, repeatMode]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;
    audio.src = currentSong.audioUrl;
    hasRecordedPlay.current = false;
    if (isPlaying) audio.play();
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

  function togglePlay() {
    ensureAudioGraph();
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  }

  function playNext() {
    const audio = audioRef.current;
    if (repeatMode === "one" && audio) {
      audio.currentTime = 0;
      setProgress(0);
      audio.play();
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
        togglePlay,
        playNext,
        playPrevious,
        seek,
        toggleShuffle,
        cycleRepeatMode,
        setBandGain,
        applyPreset,
        bassBoostPercent,
        setBassBoost,
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
