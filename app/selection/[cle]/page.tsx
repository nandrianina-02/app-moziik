"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePlayer, type PlayableSong } from "@/context/PlayerProvider";
import { useUnivers } from "@/context/UniversProvider";
import { EnteteMedia, Point, BoutonLectureMedia } from "@/components/music/EnteteMedia";
import { PochetteSelection } from "@/components/selections/PochetteSelection";
import { sourceDeLaSelection, type ResumeSelection } from "@/components/selections/CarteSelection";
import { SongRow } from "@/components/music/SongRow";
import { Skeleton, SkeletonRows } from "@/components/ui/Skeleton";

/**
 * La page d'une sélection personnelle (Mix du jour, Découvertes de la
 * semaine, Radar des sorties) : le même en-tête qu'un album ou une
 * playlist, puis ses titres. Elle est propre à celui qui la regarde :
 * l'adresse « /selection/mix-1 » montre à chacun son propre mix.
 */
export default function SelectionPage() {
  const { cle } = useParams<{ cle: string }>();
  const { data: session, status } = useSession();
  const { univers } = useUnivers();
  const { playQueue, togglePlay, playSource, isPlaying } = usePlayer();
  const [donnees, setDonnees] = useState<{ selection: ResumeSelection; titres: PlayableSong[] } | null>(null);
  const [introuvable, setIntrouvable] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    const controleur = new AbortController();
    setDonnees(null);
    setIntrouvable(false);
    fetch(`/api/selections/${cle}`, { signal: controleur.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setDonnees)
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setIntrouvable(true);
      });
    return () => controleur.abort();
  }, [cle, status, univers]);

  if (introuvable) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-bold">Sélection introuvable</h1>
        <p className="mt-2 text-sm text-ink-muted">Elle a peut-être été renouvelée depuis. Les sélections du jour sont sur l&apos;accueil.</p>
        <Link href="/" className="mt-6 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-base">
          Retour à l&apos;accueil
        </Link>
      </div>
    );
  }

  if (!donnees) {
    return (
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 md:px-10 md:py-10" aria-busy="true">
        <div className="flex items-end gap-5">
          <Skeleton className="h-48 w-48 rounded-md" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
        <div className="mt-10">
          <SkeletonRows count={8} />
        </div>
      </div>
    );
  }

  const { selection, titres } = donnees;
  const source = sourceDeLaSelection(selection);
  const enCours = playSource?.type === "playlist" && playSource.id === source.id;
  const duree = titres.reduce((total, t) => total + (t.duration ?? 0), 0);
  const heures = Math.floor(duree / 3600);
  const minutes = Math.round((duree % 3600) / 60);
  const connecte = status === "authenticated";
  const etiquette = selection.type === "mix" ? (connecte ? "Mix personnel" : "Mix") : "Playlist";

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 md:px-10 md:py-10">
      <EnteteMedia
        fond={{ couleurDe: selection.couverture }}
        pochette={<PochetteSelection s={{ ...selection, personnel: connecte }} grande />}
        etiquette={etiquette}
        titre={selection.titre}
        description={selection.description}
        infos={
          <>
            <span className="font-semibold text-ink">{connecte ? `Conçu pour ${session?.user?.name ?? "vous"}` : "Moziik"}</span>
            <Point />
            <span>
              {titres.length} titre{titres.length > 1 ? "s" : ""}
            </span>
            {duree > 0 && (
              <>
                <Point />
                <span>{heures > 0 ? `${heures} h ${minutes} min` : `${minutes} min`}</span>
              </>
            )}
          </>
        }
      >
        {titres.length > 0 && (
          <BoutonLectureMedia
            enCours={enCours && isPlaying}
            onClick={() => (enCours ? togglePlay() : playQueue(titres, 0, source))}
            libelle={selection.titre}
          />
        )}
      </EnteteMedia>

      <div className="mt-4 space-y-0.5">
        {titres.map((t, i) => (
          <div key={t._id} className="flex items-center gap-2">
            <span className="w-7 shrink-0 text-right text-sm tabular-nums text-ink-muted">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <SongRow song={t} queue={titres} index={i} source={source} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
