"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Blend } from "lucide-react";
import { usePlayer, type PlayableSong, type PlaySource } from "@/context/PlayerProvider";
import { EnteteMedia, Point, BoutonLectureMedia } from "@/components/music/EnteteMedia";
import { SongRow } from "@/components/music/SongRow";
import { SafeImage } from "@/components/ui/SafeImage";
import { Skeleton, SkeletonRows } from "@/components/ui/Skeleton";

type Personne = { name: string; username?: string; avatarUrl?: string };
type DonneesBlend = {
  moi: Personne;
  ami: Personne;
  correspondance: number;
  titres: { titre: PlayableSong; pour: "deux" | "a" | "b" }[];
};

function Avatar({ p, grand }: { p: Personne; grand?: boolean }) {
  const taille = grand ? 96 : 20;
  return (
    <SafeImage
      src={p.avatarUrl}
      alt={p.name}
      width={taille}
      height={taille}
      className={`${grand ? "h-24 w-24" : "h-5 w-5"} rounded-full object-cover ring-2 ring-base`}
    />
  );
}

/**
 * Le Blend de deux membres qui se suivent : leurs titres communs, puis
 * leurs favoris en alternance. Chaque ligne dit de qui vient le titre.
 */
export default function PageBlend() {
  const { username } = useParams<{ username: string }>();
  const { status } = useSession();
  const { playQueue, togglePlay, isPlaying, playSource } = usePlayer();
  const [donnees, setDonnees] = useState<DonneesBlend | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch(`/api/blend/${username}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Le Blend n'a pas pu être chargé.");
        setDonnees(await r.json());
      })
      .catch((e: Error) => setErreur(e.message));
  }, [status, username]);

  if (status === "unauthenticated" || erreur) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16 animate-fade-in-up">
        <Blend size={26} className="mb-3 text-ink-muted" />
        <h1 className="font-display text-2xl font-bold">Blend</h1>
        <p className="mt-1 text-sm text-ink-muted">{erreur ?? "Connectez-vous pour voir ce Blend."}</p>
        <Link href={status === "unauthenticated" ? "/connexion" : "/amis"} className="mt-5 inline-block text-sm font-medium text-accent hover:underline">
          {status === "unauthenticated" ? "Se connecter" : "Retour à vos amis"}
        </Link>
      </div>
    );
  }

  if (!donnees) {
    return (
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 md:px-10 md:py-10">
        <div className="flex items-end gap-6">
          <Skeleton className="h-48 w-48 rounded-md" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
        <div className="mt-8">
          <SkeletonRows count={8} />
        </div>
      </div>
    );
  }

  const { moi, ami, titres } = donnees;
  const file = titres.map((t) => t.titre);
  const source: PlaySource = { type: "queue", label: `Blend avec ${ami.name}` };
  const enCours = playSource?.label === source.label;
  const communs = titres.filter((t) => t.pour === "deux").length;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 md:px-10 md:py-10">
      <EnteteMedia
        fond={{ couleurDe: ami.avatarUrl ?? moi.avatarUrl }}
        pochette={
          <div className="grid aspect-square w-full place-items-center rounded-md bg-ink/[0.08]">
            <div className="flex -space-x-6">
              <Avatar p={moi} grand />
              <Avatar p={ami} grand />
            </div>
          </div>
        }
        etiquette="Blend"
        titre={`${moi.name.split(" ")[0]} et ${ami.name.split(" ")[0]}`}
        description={
          titres.length === 0
            ? "Pas encore assez d'écoutes de part et d'autre pour composer ce Blend."
            : `${donnees.correspondance} % d'artistes en commun${communs > 0 ? `, et ${communs} titre${communs > 1 ? "s" : ""} que vous écoutez tous les deux` : ""}.`
        }
        infos={
          <>
            <Link href={ami.username ? `/membre/${ami.username}` : "#"} className="font-semibold text-ink hover:underline">
              {ami.name}
            </Link>
            <Point />
            <span>
              {titres.length} titre{titres.length > 1 ? "s" : ""}
            </span>
          </>
        }
      >
        {file.length > 0 && (
          <BoutonLectureMedia
            enCours={enCours && isPlaying}
            onClick={() => (enCours ? togglePlay() : playQueue(file, 0, source))}
            libelle={`Blend avec ${ami.name}`}
          />
        )}
      </EnteteMedia>

      <div className="mt-4 space-y-0.5">
        {titres.map(({ titre, pour }, i) => (
          <div key={titre._id} className="flex items-center gap-2">
            {/* De qui vient le titre : un avatar, ou les deux superposés. */}
            <span
              className="flex w-9 shrink-0 justify-end -space-x-2"
              title={pour === "deux" ? "Vous l'écoutez tous les deux" : pour === "a" ? "Dans vos favoris" : `Dans les favoris de ${ami.name}`}
            >
              {(pour === "deux" || pour === "a") && <Avatar p={moi} />}
              {(pour === "deux" || pour === "b") && <Avatar p={ami} />}
            </span>
            <div className="min-w-0 flex-1">
              <SongRow song={titre} queue={file} index={i} source={source} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
