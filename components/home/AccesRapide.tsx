"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Heart, Headphones, Loader2, Pause, Play } from "lucide-react";
import { usePlayer, type PlayableSong } from "@/context/PlayerProvider";
import { useToast } from "@/context/ToastProvider";
import { useUnivers } from "@/context/UniversProvider";
import { SafeImage } from "@/components/ui/SafeImage";
import { EqualizerLoader } from "@/components/ui/EqualizerLoader";
import { useBandeSon } from "@/components/home/useBandeSon";

/**
 * L'accès rapide, en tête d'accueil : huit tuiles à reprendre d'un geste.
 * La bande son, les titres aimés, puis les derniers titres écoutés ; pour
 * un visiteur, les titres du moment à la place de ses écoutes.
 *
 * Toute la tuile mène à ce qu'elle représente ; le bouton de lecture, qui
 * apparaît au survol (toujours visible au toucher), lance l'écoute sans
 * quitter l'accueil.
 */
const TUILES = 8;

function BoutonLecture({ enCours, chargement, onClick, libelle }: { enCours: boolean; chargement?: boolean; onClick: () => void; libelle: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      aria-label={libelle}
      className={`mr-2 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-base shadow-lg transition-all duration-200 hover:scale-105 hover:bg-accent-hover ${
        enCours ? "opacity-100" : "opacity-100 md:translate-y-1 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100"
      }`}
    >
      {chargement ? <Loader2 size={16} className="animate-spin" /> : enCours ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="translate-x-px" />}
    </button>
  );
}

function Tuile({
  href,
  titre,
  visuel,
  enCours,
  actif,
  chargement,
  onLecture,
}: {
  href: string;
  titre: string;
  visuel: React.ReactNode;
  enCours: boolean;
  actif: boolean;
  chargement?: boolean;
  onLecture: () => void;
}) {
  return (
    <Link
      href={href}
      className="group relative flex h-14 items-center gap-3 overflow-hidden rounded-md bg-ink/[0.06] transition-colors duration-200 hover:bg-ink/[0.12] md:h-16"
    >
      <span className="h-full aspect-square shrink-0 overflow-hidden bg-surface">{visuel}</span>
      <span className={`line-clamp-2 min-w-0 flex-1 text-[13px] font-semibold leading-tight md:text-sm ${actif ? "text-accent" : "text-ink"}`}>
        {titre}
      </span>
      {actif && enCours && (
        <span className="mr-1 md:group-hover:hidden">
          <EqualizerLoader size="sm" />
        </span>
      )}
      <span className={actif && enCours ? "hidden md:group-hover:block" : ""}>
        <BoutonLecture enCours={actif && enCours} chargement={chargement} onClick={onLecture} libelle={actif && enCours ? `Mettre ${titre} en pause` : `Écouter ${titre}`} />
      </span>
    </Link>
  );
}

export function AccesRapide({ secours }: { secours: PlayableSong[] }) {
  const { data: session, status } = useSession();
  const { playQueue, currentSong, isPlaying, togglePlay, playSource } = usePlayer();
  const pushToast = useToast();
  const { univers } = useUnivers();
  const bandeSon = useBandeSon();
  const [recents, setRecents] = useState<PlayableSong[] | null>(null);
  const connecte = status === "authenticated";

  useEffect(() => {
    if (!connecte) return;
    const controleur = new AbortController();
    fetch("/api/me/recent", { signal: controleur.signal })
      .then((r) => (r.ok ? r.json() : { songs: [] }))
      .then((d) => setRecents(d.songs ?? []))
      .catch(() => setRecents([]));
    return () => controleur.abort();
  }, [connecte, univers]);

  async function lancerAimes() {
    try {
      const res = await fetch("/api/me/liked-songs");
      const { songs } = (await res.json()) as { songs: PlayableSong[] };
      if (!songs?.length) {
        pushToast("info", "Aucun titre aimé pour l'instant.");
        return;
      }
      playQueue(songs, 0, { type: "favorites", label: "Titres aimés" });
    } catch {
      pushToast("error", "Les titres aimés n'ont pas pu être chargés.");
    }
  }

  // Les écoutes du compte, à défaut les titres du moment.
  const titres = (connecte && recents && recents.length > 0 ? recents : secours).slice(0, connecte ? TUILES - 2 : TUILES - 1);
  const sourceTitres = connecte && recents?.length ? { type: "history" as const, label: "Récemment écoutés" } : { type: "home" as const, label: "Accueil" };
  const stationEnCours = playSource?.type === "radio";

  // Rien à montrer tant que les écoutes (ou, pour un visiteur, les titres du moment) ne sont pas arrivées.
  if ((connecte && recents === null) || (!connecte && secours.length === 0)) {
    return (
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-busy="true">
        {Array.from({ length: TUILES }, (_, i) => (
          <span key={i} className="h-14 animate-pulse rounded-md bg-ink/[0.06] md:h-16" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Tuile
        href="/radio"
        titre={session?.user ? "Ma bande son" : "Sélection Moziik"}
        visuel={
          <span className="grid h-full w-full place-items-center bg-accent text-base">
            <Headphones size={22} />
          </span>
        }
        actif={stationEnCours}
        enCours={stationEnCours && isPlaying}
        chargement={bandeSon.chargement}
        onLecture={() => (stationEnCours ? togglePlay() : bandeSon.lancer())}
      />
      {connecte && (
        <Tuile
          href="/bibliotheque"
          titre="Titres aimés"
          visuel={
            <span className="grid h-full w-full place-items-center bg-ink/10 text-accent">
              <Heart size={20} fill="currentColor" />
            </span>
          }
          actif={playSource?.type === "favorites"}
          enCours={playSource?.type === "favorites" && isPlaying}
          onLecture={() => (playSource?.type === "favorites" ? togglePlay() : lancerAimes())}
        />
      )}
      {titres.map((t, i) => {
        const actif = currentSong?._id === t._id;
        return (
          <Tuile
            key={t._id}
            href={`/son/${t._id}`}
            titre={t.title}
            visuel={<SafeImage src={t.coverUrl} alt="" width={64} height={64} className="h-full w-full object-cover" />}
            actif={actif}
            enCours={actif && isPlaying}
            onLecture={() => (actif ? togglePlay() : playQueue(titres, i, sourceTitres))}
          />
        );
      })}
    </div>
  );
}
