"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useDragControls, useMotionValue, useTransform } from "framer-motion";
import {
  BadgeCheck,
  Check,
  ChevronDown,
  Download,
  Flame,
  Gauge,
  Heart,
  Info,
  ListMusic,
  ListPlus,
  Loader2,
  Maximize2,
  MessageCircle,
  Mic2,
  Minimize2,
  Moon,
  MoreHorizontal,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Share2,
  Shuffle,
  SignalHigh,
  SkipBack,
  SkipForward,
  Sparkles,
  Users,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { usePlayer } from "@/context/PlayerProvider";
import { useToast } from "@/context/ToastProvider";
import { useOnlineStatus } from "@/context/OnlineStatusProvider";
import { SeekBar } from "@/components/player/SeekBar";
import { QueuePanel } from "@/components/player/panels/QueuePanel";
import { LyricsPanel } from "@/components/player/panels/LyricsPanel";
import { InfoPanel } from "@/components/player/panels/InfoPanel";
import { CreditsPanel } from "@/components/player/panels/CreditsPanel";
import { SimilarPanel } from "@/components/player/panels/SimilarPanel";
import { BassBoostMenu, QualityMenu, SleepMenu, SpeedMenu } from "@/components/player/panels/AudioMenus";
import { useSongDetails } from "@/components/player/hooks/useSongDetails";
import { usePlayerShortcuts } from "@/components/player/hooks/usePlayerShortcuts";
import { CommentsSection } from "@/components/music/CommentsSection";
import { SongContextMenu } from "@/components/music/SongContextMenu";
import { AddToPlaylistModal } from "@/components/modals/AddToPlaylistModal";
import { ShareModal } from "@/components/share/ShareModal";
import { buildSongSubject } from "@/components/share/shareSubject";
import { NIVEAUX_BASS } from "@/components/player/constants/bassBoost";
import { downloadSongForOffline, isSongOffline, removeOfflineSong, queuePendingDownload } from "@/lib/offlineCache";
import type { PlayableSong } from "@/context/PlayerProvider";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useScrollLock } from "@/lib/scrollLock";
import type { MenuAnchor } from "@/components/ui/useClampedMenuPosition";

/** Distance de glissement (px) à partir de laquelle le lecteur se ferme au relâchement. */
const CLOSE_THRESHOLD = 120;
/** Vitesse (px/s) qui ferme le lecteur même sur un geste court et vif. */
const CLOSE_VELOCITY = 700;

type Onglet = "paroles" | "infos" | "credits" | "similaires" | "commentaires";

const ONGLETS: { id: Onglet; label: string; court: string; icon: typeof Mic2 }[] = [
  { id: "paroles", label: "Paroles", court: "Paroles", icon: Mic2 },
  { id: "infos", label: "Informations", court: "Infos", icon: Info },
  { id: "credits", label: "Crédits", court: "Crédits", icon: Users },
  { id: "similaires", label: "Titres similaires", court: "Similaires", icon: Sparkles },
  { id: "commentaires", label: "Commentaires", court: "Avis", icon: MessageCircle },
];

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Lecteur plein écran.
 *
 * L'égaliseur 10 bandes qui occupait la colonne centrale a été retiré :
 * cette place revient aux paroles, qui sont ce qu'on regarde réellement
 * en écoutant. Les réglages audio (Bass Boost, vitesse, qualité, minuteur)
 * passent en menus ancrés dans la barre de transport, où on les cherche.
 *
 * Toute la logique de lecture reste dans PlayerProvider : ce composant ne
 * fait que l'afficher.
 */
export function FullPlayerPage() {
  const { isFullPlayerOpen, currentSong } = usePlayer();
  return (
    <AnimatePresence>
      {isFullPlayerOpen && currentSong && <ContenuLecteur key="lecteur" song={currentSong} />}
    </AnimatePresence>
  );
}

function ContenuLecteur({ song }: { song: PlayableSong }) {
  const {
    isFullPlayerOpen,
    queue,
    reserveCount,
    isPlaying,
    progress,
    duration,
    volume,
    setVolume,
    togglePlay,
    playNext,
    playPrevious,
    seek,
    closeFullPlayer,
    isShuffled,
    toggleShuffle,
    repeatMode,
    cycleRepeatMode,
    playSource,
    bassBoost,
    playbackRate,
    audioQuality,
    sleepRemainingMs,
    sleepAfterTrack,
  } = usePlayer();
  const pushToast = useToast();
  const { isOnline } = useOnlineStatus();
  const { details } = useSongDetails(song._id);
  usePlayerShortcuts({ pleinEcran: true });

  // Les deux mises en page ne peuvent pas coexister dans le DOM : elles
  // portent chacune la barre d'onglets et son contenu. Montées ensemble,
  // elles créaient deux `role="tablist"`, deux animations partageant le
  // même `layoutId`, et surtout deux fois les requêtes des onglets
  // « Titres similaires » et « Commentaires ». On n'en monte qu'une.
  const bureau = useMediaQuery("(min-width: 1024px)");
  const colonneFile = useMediaQuery("(min-width: 1280px)");

  const [onglet, setOnglet] = useState<Onglet>("paroles");
  const [offlineState, setOfflineState] = useState<"idle" | "saving" | "saved">("idle");
  const [liked, setLiked] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuAnchor | null>(null);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showQueueSheet, setShowQueueSheet] = useState(false);
  const [reglage, setReglage] = useState<{ type: "bass" | "vitesse" | "qualite" | "veille"; anchor: MenuAnchor } | null>(
    null
  );
  const [plein, setPlein] = useState(false);

  /* Glissement vers le bas pour fermer.
     Le geste passe par les outils de framer-motion — une MotionValue et
     `useDragControls` — et non plus par un état React réécrit à chaque
     `pointermove`. Deux raisons, la seconde étant un vrai défaut mesuré :
     1. une MotionValue s'écrit sans re-rendu, alors que l'ancien `dragY`
        re-rendait tout le lecteur à la fréquence du doigt ;
     2. l'ancienne version passait aussi `transform` et `opacity` dans un
        `style` brut, EN MÊME TEMPS que `animate`/`exit` les animait. Deux
        propriétaires pour la même propriété : chaque re-rendu (le lecteur
        en reçoit ~4 par seconde pendant la lecture) interrompait
        l'animation de sortie, l'opacité se figeait à ~0,005 et le
        composant n'était jamais démonté. Le calque `fixed inset-0 z-50`
        restait alors sur la page, invisible, avalant tous les clics —
        « l'écran devient incliquable ». */
  const controlesGlissement = useDragControls();
  const y = useMotionValue(0);
  const opaciteGlissement = useTransform(y, [0, 400], [1, 0.45]);

  // Vrai si une surcouche (menu, modale, feuille) est ouverte : Échap doit
  // alors la fermer, elle, avant de fermer le lecteur.
  const surcoucheOuverte =
    !!menuPosition || !!reglage || showAddToPlaylist || showShareModal || showQueueSheet;

  useEffect(() => {
    function onEscape(e: KeyboardEvent) {
      if (e.key !== "Escape" || surcoucheOuverte) return;
      closeFullPlayer();
    }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [surcoucheOuverte, closeFullPlayer]);

  // Le corps ne doit pas défiler derrière le lecteur ouvert. Le verrou est
  // relâché dès le DÉBUT de la fermeture, pas à la fin de l'animation :
  // même si celle-ci était interrompue, la page resterait utilisable.
  useScrollLock(isFullPlayerOpen);

  useEffect(() => {
    const suivre = () => setPlein(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", suivre);
    return () => document.removeEventListener("fullscreenchange", suivre);
  }, []);

  useEffect(() => {
    let annule = false;
    isSongOffline(song._id).then((offline) => {
      if (!annule) setOfflineState(offline ? "saved" : "idle");
    });
    fetch(`/api/songs/${song._id}/like`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!annule && data) setLiked(data.liked);
      })
      .catch(() => undefined);
    return () => {
      annule = true;
    };
  }, [song._id]);

  /**
   * Amorce le glissement depuis une zone « prise en main » (barre du haut,
   * pochette). Un geste qui commence sur une commande est laissé à cette
   * commande : sinon le bouton de fermeture, celui du plein écran et le
   * menu « Autres options » devenaient des poignées de glissement.
   */
  function demarrerGlissement(e: React.PointerEvent) {
    if (bureau) return;
    if ((e.target as HTMLElement).closest("button, a, input, [role='slider']")) return;
    controlesGlissement.start(e);
  }

  async function basculerPleinEcran() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      pushToast("info", "Le plein écran a été refusé par le navigateur.");
    }
  }

  async function handleToggleOffline() {
    if (offlineState === "saving") return;
    const charge = {
      _id: song._id,
      title: song.title,
      coverUrl: song.coverUrl,
      audioUrl: song.audioUrl,
      duration: song.duration,
      artist: song.artist ?? { _id: "", stageName: "Artiste supprimé" },
    };
    try {
      if (offlineState === "saved") {
        await removeOfflineSong(song._id);
        setOfflineState("idle");
        pushToast("success", "Retiré du mode hors-ligne.");
      } else if (!isOnline) {
        await queuePendingDownload(charge);
        pushToast("info", "En attente — le téléchargement démarrera à la reconnexion.");
      } else {
        setOfflineState("saving");
        await downloadSongForOffline(charge);
        setOfflineState("saved");
        pushToast("success", "Disponible hors-ligne.");
      }
    } catch (err) {
      setOfflineState("idle");
      pushToast("error", err instanceof Error ? err.message : "Échec du mode hors-ligne.");
    }
  }

  async function handleToggleLike() {
    const suivant = !liked;
    setLiked(suivant);
    try {
      const res = await fetch(`/api/songs/${song._id}/like`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLiked(data.liked);
      pushToast("success", data.liked ? "Ajouté à tes favoris." : "Retiré de tes favoris.");
    } catch {
      setLiked(!suivant);
      pushToast("error", "Connecte-toi pour aimer un son.");
    }
  }

  const RepeatIcon = repeatMode === "one" ? Repeat1 : Repeat;
  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const OfflineIcon = offlineState === "saving" ? Loader2 : offlineState === "saved" ? Check : Download;

  const album = details?.album ?? (typeof song.album === "object" ? song.album : null);
  const genre = details?.genre ?? song.genre;
  const anneeSortie = (() => {
    const brut = details?.releaseDate ?? song.releaseDate;
    if (!brut) return null;
    const d = new Date(brut);
    return Number.isNaN(d.getTime()) ? null : d.getFullYear();
  })();

  const niveauBass = NIVEAUX_BASS.find((n) => n.id === bassBoost);
  const bassActif = bassBoost !== "off";
  const veilleActive = sleepRemainingMs !== null || sleepAfterTrack;
  const veilleTexte = sleepAfterTrack
    ? "Fin du morceau"
    : sleepRemainingMs !== null
      ? `${Math.ceil(sleepRemainingMs / 60000)} min`
      : "Minuteur";

  function ouvrirReglage(type: "bass" | "vitesse" | "qualite" | "veille", e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setReglage({ type, anchor: { x: rect.left, y: rect.top } });
  }

  /* ------------------------------------------------------ blocs communs -- */

  const contenuOnglet = (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={onglet}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18 }}
        className="flex min-h-0 flex-1 flex-col"
      >
        {onglet === "paroles" && (
          <LyricsPanel
            lyrics={details?.lyrics ?? song.lyrics}
            progress={progress}
            onSeek={seek}
            titre={song.title}
            artiste={song.artist?.stageName}
            className="min-h-0 flex-1"
          />
        )}
        {onglet === "infos" && (
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <InfoPanel song={song} details={details} />
          </div>
        )}
        {onglet === "credits" && (
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <CreditsPanel song={song} details={details} />
          </div>
        )}
        {onglet === "similaires" && (
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <SimilarPanel songId={song._id} />
          </div>
        )}
        {onglet === "commentaires" && (
          <div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-6">
            <CommentsSection songId={song._id} />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );

  const barreOnglets = (
    <div
      role="tablist"
      aria-label="Détails du morceau"
      className="mb-4 flex shrink-0 gap-1 overflow-x-auto border-b border-border pb-px"
    >
      {ONGLETS.map((o) => {
        const actif = onglet === o.id;
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={actif}
            onClick={() => setOnglet(o.id)}
            className={`relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
              actif ? "text-accent" : "text-ink-muted hover:text-ink"
            }`}
          >
            <o.icon size={14} />
            <span className="hidden sm:inline">{o.label}</span>
            <span className="sm:hidden">{o.court}</span>
            {actif && (
              <motion.span
                layoutId="onglet-actif"
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );

  const transport = (taille: "compact" | "large") => {
    const grand = taille === "large";
    return (
      <div className={`flex items-center justify-center ${grand ? "gap-6" : "gap-5"}`}>
        <button
          onClick={toggleShuffle}
          aria-label="Lecture aléatoire"
          aria-pressed={isShuffled}
          title="Lecture aléatoire"
          className={`transition-colors ${isShuffled ? "text-accent" : "text-ink-muted hover:text-ink"}`}
        >
          <Shuffle size={grand ? 19 : 18} />
        </button>
        <button
          onClick={playPrevious}
          aria-label="Précédent"
          title="Précédent (P)"
          className="text-ink transition-colors hover:text-accent"
        >
          <SkipBack size={grand ? 26 : 24} fill="currentColor" />
        </button>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Lecture"}
          title={isPlaying ? "Pause (Espace)" : "Lecture (Espace)"}
          className={`grid place-items-center rounded-full bg-accent text-base shadow-lg shadow-accent/25 transition-colors hover:bg-accent-hover ${
            grand ? "h-16 w-16" : "h-14 w-14"
          }`}
        >
          {isPlaying ? (
            <Pause size={grand ? 26 : 23} fill="currentColor" />
          ) : (
            <Play size={grand ? 26 : 23} fill="currentColor" className="ml-0.5" />
          )}
        </motion.button>
        <button
          onClick={playNext}
          aria-label="Suivant"
          title="Suivant (N)"
          className="text-ink transition-colors hover:text-accent"
        >
          <SkipForward size={grand ? 26 : 24} fill="currentColor" />
        </button>
        <button
          onClick={cycleRepeatMode}
          aria-label="Répéter"
          aria-pressed={repeatMode !== "off"}
          title={repeatMode === "one" ? "Répéter le titre" : repeatMode === "all" ? "Répéter la file" : "Répéter"}
          className={`transition-colors ${repeatMode !== "off" ? "text-accent" : "text-ink-muted hover:text-ink"}`}
        >
          <RepeatIcon size={grand ? 19 : 18} />
        </button>
      </div>
    );
  };

  const chipsMeta = (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {album && (
        <Link
          href={`/album/${album._id}`}
          className="rounded-full border border-border px-2.5 py-1 text-[11px] text-ink-muted transition-colors hover:border-accent hover:text-accent"
        >
          {album.title}
        </Link>
      )}
      {genre && (
        <span className="rounded-full border border-border px-2.5 py-1 text-[11px] text-ink-muted">{genre}</span>
      )}
      {anneeSortie && (
        <span className="rounded-full border border-border px-2.5 py-1 text-[11px] text-ink-muted">{anneeSortie}</span>
      )}
      <span className="rounded-full border border-border px-2.5 py-1 text-[11px] tabular-nums text-ink-muted">
        {formatTime(duration)}
      </span>
    </div>
  );

  /** Réglages secondaires : Bass Boost, vitesse, qualité, veille, file, plein écran. */
  const reglagesSecondaires = (
    <div className="flex flex-wrap items-center justify-center gap-1">
      <BoutonReglage
        icon={Flame}
        actif={bassActif}
        label="Bass Boost"
        valeur={niveauBass && bassActif ? niveauBass.label : "Off"}
        onClick={(e) => ouvrirReglage("bass", e)}
      />
      <BoutonReglage
        icon={Gauge}
        actif={playbackRate !== 1}
        label="Vitesse"
        valeur={`${playbackRate}×`}
        onClick={(e) => ouvrirReglage("vitesse", e)}
      />
      <BoutonReglage
        icon={SignalHigh}
        actif={false}
        label="Qualité"
        valeur={{ low: "64k", medium: "128k", high: "320k" }[audioQuality]}
        onClick={(e) => ouvrirReglage("qualite", e)}
      />
      <BoutonReglage
        icon={Moon}
        actif={veilleActive}
        label="Minuteur"
        valeur={veilleTexte}
        onClick={(e) => ouvrirReglage("veille", e)}
      />
      {!colonneFile && (
        <BoutonReglage
          icon={ListMusic}
          actif={false}
          label="File"
          valeur={String(queue.length + reserveCount)}
          onClick={() => setShowQueueSheet(true)}
        />
      )}
      <BoutonReglage
        icon={plein ? Minimize2 : Maximize2}
        actif={plein}
        label="Plein écran"
        valeur={plein ? "Réduire" : "Plein écran"}
        onClick={basculerPleinEcran}
      />
    </div>
  );

  const actionsTitre = (
    <div className="flex items-center justify-center gap-1">
      <ActionRonde
        icon={Heart}
        label={liked ? "Retirer des favoris" : "Ajouter aux favoris"}
        actif={liked}
        rempli={liked}
        onClick={handleToggleLike}
      />
      <ActionRonde
        icon={OfflineIcon}
        label={offlineState === "saved" ? "Retirer du hors-ligne" : "Télécharger"}
        actif={offlineState === "saved"}
        tourne={offlineState === "saving"}
        onClick={handleToggleOffline}
      />
      <ActionRonde icon={ListPlus} label="Ajouter à une playlist" onClick={() => setShowAddToPlaylist(true)} />
      <ActionRonde icon={Share2} label="Partager" onClick={() => setShowShareModal(true)} />
      <ActionRonde
        icon={MoreHorizontal}
        label="Autres options"
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setMenuPosition({ x: rect.left, y: rect.top });
        }}
      />
    </div>
  );

  return (
    <motion.div
      // Ouverture par le bas, fermeture par le bas : le même geste, qu'il
      // vienne du bouton, de la touche Échap ou du glissement — l'animation
      // de sortie repart de la position atteinte par le doigt.
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 330, damping: 36, mass: 0.9 }}
      // Seules des MotionValue ici — aucune valeur brute qui viendrait
      // disputer à framer-motion la propriété qu'il anime.
      style={{ y, opacity: opaciteGlissement }}
      drag={bureau ? false : "y"}
      dragControls={controlesGlissement}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.6 }}
      dragMomentum={false}
      onDragEnd={(_, info) => {
        if (info.offset.y > CLOSE_THRESHOLD || info.velocity.y > CLOSE_VELOCITY) closeFullPlayer();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Lecteur — ${song.title}`}
      // Pendant l'animation de sortie le calque couvre encore tout l'écran :
      // sans cela il continuerait d'intercepter les clics destinés à la page.
      className={`fixed inset-0 z-50 flex flex-col bg-base ${isFullPlayerOpen ? "" : "pointer-events-none"}`}
    >
      {/* ------------------------------------------------------- en-tête -- */}
      <div onPointerDown={demarrerGlissement} className="shrink-0 lg:touch-auto touch-pan-x">
        <header className="flex items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4">
          <button
            onClick={closeFullPlayer}
            aria-label="Fermer le lecteur"
            title="Fermer (Échap)"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <ChevronDown size={22} />
          </button>

          <span className="flex min-w-0 flex-col items-center">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
              En cours de lecture
            </span>
            {playSource?.label && (
              <span className="mt-0.5 max-w-[60vw] truncate text-[11px] text-ink-muted md:max-w-md">
                depuis {playSource.label}
              </span>
            )}
          </span>

          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={basculerPleinEcran}
              aria-label={plein ? "Quitter le plein écran" : "Plein écran"}
              title={plein ? "Quitter le plein écran (F)" : "Plein écran (F)"}
              className="hidden h-9 w-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface hover:text-ink md:grid"
            >
              {plein ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button
              onClick={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setMenuPosition({ x: rect.left, y: rect.top });
              }}
              aria-label="Autres options"
              className="grid h-9 w-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface hover:text-ink"
            >
              <MoreHorizontal size={20} />
            </button>
          </div>
        </header>

        {/* Poignée : indique que la zone se glisse vers le bas pour fermer. */}
        <div className="flex justify-center pb-1 lg:hidden">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>
      </div>

      {/* ============================ MOBILE / TABLETTE (< lg) ============ */}
      {!bureau && (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
        <div className="mx-auto w-full max-w-md">
          <div
            onPointerDown={demarrerGlissement}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenuPosition({ x: e.clientX, y: e.clientY });
            }}
            className="relative mx-auto mb-5 w-full max-w-[300px] touch-pan-x"
          >
            <SafeImage
              src={song.coverUrl}
              alt={song.title}
              width={300}
              height={300}
              className="aspect-square w-full rounded-xl2 object-cover shadow-2xl"
              priority
            />
          </div>

          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-display text-ink">{song.title}</h1>
              {song.artist ? (
                <Link
                  href={`/artiste/${song.artist._id}`}
                  className="flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-accent"
                >
                  <span className="truncate">{song.artist.stageName}</span>
                  {song.artist.verified && <BadgeCheck size={14} className="shrink-0 text-verified" />}
                </Link>
              ) : (
                <p className="text-sm text-ink-muted">Artiste supprimé</p>
              )}
            </div>
            <button
              onClick={handleToggleLike}
              aria-label={liked ? "Ne plus aimer" : "J'aime"}
              aria-pressed={liked}
              className={`shrink-0 transition-colors ${liked ? "text-accent" : "text-ink-muted hover:text-ink"}`}
            >
              <Heart size={22} fill={liked ? "currentColor" : "none"} />
            </button>
          </div>

          <div className="mb-4">{chipsMeta}</div>

          <SeekBar progress={progress} duration={duration} onSeek={seek} variant="pill" />
          <div className="-mt-1 mb-5 flex justify-between text-xs tabular-nums text-ink-muted">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          <div className="mb-5">{transport("compact")}</div>

          <div className="mb-5 flex items-center gap-3">
            <button
              onClick={() => setVolume(volume > 0 ? 0 : 1)}
              aria-label={volume === 0 ? "Réactiver le son" : "Couper le son"}
              className="shrink-0 text-ink-muted transition-colors hover:text-ink"
            >
              <VolumeIcon size={18} />
            </button>
            <SeekBar progress={volume} duration={1} onSeek={setVolume} variant="pill" className="flex-1" />
          </div>

          <div className="mb-5">{actionsTitre}</div>
          <div className="mb-6">{reglagesSecondaires}</div>

          {barreOnglets}
          {/* Hauteur bornée : les paroles ont besoin de leur propre zone de
              défilement pour pouvoir se recentrer sur la ligne chantée.
              Sans hauteur définie, ce conteneur s'étirerait à l'infini et le
              suivi automatique n'aurait plus rien à faire défiler. */}
          <div className="flex h-[58vh] flex-col">{contenuOnglet}</div>
        </div>
      </div>
      )}

      {/* ================================ BUREAU (lg et plus) ============= */}
      {bureau && (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 gap-8 px-6 pb-2 xl:px-10">
          {/* Colonne 1 — pochette et identité */}
          <div className="flex w-[300px] shrink-0 flex-col xl:w-[340px]">
            <div
              onContextMenu={(e) => {
                e.preventDefault();
                setMenuPosition({ x: e.clientX, y: e.clientY });
              }}
            >
              <SafeImage
                src={song.coverUrl}
                alt={song.title}
                width={340}
                height={340}
                className="aspect-square w-full rounded-xl2 object-cover shadow-2xl"
                priority
              />
            </div>

            <div className="mt-5 text-center">
              <h1 className="truncate text-2xl font-display text-ink">{song.title}</h1>
              {song.artist ? (
                <Link
                  href={`/artiste/${song.artist._id}`}
                  className="mt-1 inline-flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-accent"
                >
                  <span className="truncate">{song.artist.stageName}</span>
                  {song.artist.verified && <BadgeCheck size={14} className="shrink-0 text-verified" />}
                </Link>
              ) : (
                <p className="mt-1 text-sm text-ink-muted">Artiste supprimé</p>
              )}
            </div>

            <div className="mt-4">{chipsMeta}</div>
            <div className="mt-4">{actionsTitre}</div>

            {song.featuring && song.featuring.length > 0 && (
              <p className="mt-4 text-center text-xs text-ink-muted">
                avec{" "}
                {song.featuring
                  .filter((f) => f.artist)
                  .map((f) => f.artist.stageName)
                  .join(", ")}
              </p>
            )}
          </div>

          {/* Colonne 2 — onglets, dominés par les paroles */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {barreOnglets}
            {contenuOnglet}
          </div>

          {/* Colonne 3 — file d'attente et historique */}
          {colonneFile && (
            <div className="flex w-[330px] shrink-0 flex-col">
              <div className="flex min-h-0 flex-1 flex-col rounded-xl2 border border-border bg-surface p-4">
                <QueuePanel />
              </div>
            </div>
          )}
        </div>

        {/* Barre de transport, sur toute la largeur */}
        <div className="shrink-0 border-t border-border bg-surface/60 px-6 py-3 backdrop-blur-sm xl:px-10">
          <div className="mx-auto flex w-full max-w-[1600px] items-center gap-6">
            <div className="flex w-[220px] shrink-0 items-center gap-3 2xl:w-[280px]">
              <SafeImage
                src={song.coverUrl}
                alt=""
                width={44}
                height={44}
                className="h-11 w-11 shrink-0 rounded-lg object-cover"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">{song.title}</span>
                <span className="block truncate text-xs text-ink-muted">
                  {song.artist?.stageName ?? "Artiste supprimé"}
                </span>
              </span>
            </div>

            <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              {transport("large")}
              <div className="flex w-full items-center gap-2.5">
                <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-ink-muted">
                  {formatTime(progress)}
                </span>
                <SeekBar
                  progress={progress}
                  duration={duration}
                  onSeek={seek}
                  variant="pill"
                  className="min-w-0 flex-1"
                />
                <span className="w-10 shrink-0 text-[11px] tabular-nums text-ink-muted">{formatTime(duration)}</span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              {reglagesSecondaires}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setVolume(volume > 0 ? 0 : 1)}
                  aria-label={volume === 0 ? "Réactiver le son" : "Couper le son"}
                  title="Couper le son (M)"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-base hover:text-ink"
                >
                  <VolumeIcon size={18} />
                </button>
                <div className="hidden w-20 xl:block">
                  <SeekBar progress={volume} duration={1} onSeek={setVolume} variant="pill" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ------------------------------------------------- surcouches ---- */}
      {menuPosition && (
        <SongContextMenu song={song} position={menuPosition} onClose={() => setMenuPosition(null)} />
      )}
      {reglage?.type === "bass" && <BassBoostMenu anchor={reglage.anchor} onClose={() => setReglage(null)} />}
      {reglage?.type === "vitesse" && <SpeedMenu anchor={reglage.anchor} onClose={() => setReglage(null)} />}
      {reglage?.type === "qualite" && <QualityMenu anchor={reglage.anchor} onClose={() => setReglage(null)} />}
      {reglage?.type === "veille" && <SleepMenu anchor={reglage.anchor} onClose={() => setReglage(null)} />}

      <AnimatePresence>
        {showQueueSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60"
            onClick={() => setShowQueueSheet(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[78vh] w-full flex-col rounded-t-3xl bg-surface md:max-w-lg"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
                <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                  <ListMusic size={15} className="text-accent" /> File d&apos;attente
                </span>
                <button
                  onClick={() => setShowQueueSheet(false)}
                  aria-label="Fermer la file d'attente"
                  className="text-ink-muted transition-colors hover:text-ink"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
                <QueuePanel compact />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showAddToPlaylist && <AddToPlaylistModal songId={song._id} onClose={() => setShowAddToPlaylist(false)} />}
      {showShareModal && (
        <ShareModal
          subject={buildSongSubject(song)}
          onClose={() => setShowShareModal(false)}
          onOpenAddToPlaylist={() => setShowAddToPlaylist(true)}
        />
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------ éléments -- */

function ActionRonde({
  icon: Icon,
  label,
  actif,
  rempli,
  tourne,
  onClick,
}: {
  icon: typeof Heart;
  label: string;
  actif?: boolean;
  rempli?: boolean;
  tourne?: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={actif}
      className={`grid h-10 w-10 place-items-center rounded-full transition-colors ${
        actif ? "text-accent hover:bg-accent/10" : "text-ink-muted hover:bg-surface hover:text-ink"
      }`}
    >
      <Icon size={19} fill={rempli ? "currentColor" : "none"} className={tourne ? "animate-spin" : ""} />
    </button>
  );
}

function BoutonReglage({
  icon: Icon,
  label,
  valeur,
  actif,
  onClick,
  className = "",
}: {
  icon: typeof Flame;
  label: string;
  valeur: string;
  actif?: boolean;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={`${label} — ${valeur}`}
      aria-label={`${label} : ${valeur}`}
      aria-haspopup="menu"
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
        actif
          ? "border-accent bg-accent/12 text-accent"
          : "border-border text-ink-muted hover:border-accent hover:text-accent"
      } ${className}`}
    >
      <Icon size={13} />
      <span className="hidden max-w-[7rem] truncate sm:inline">{valeur}</span>
    </button>
  );
}
