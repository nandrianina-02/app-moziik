"use client";

import Link from "next/link";
import { usePlayer, type PlayableSong, type PlaySource } from "@/context/PlayerProvider";
import { BoutonLectureCarte } from "@/components/music/BoutonLectureCarte";
import { PochetteSelection } from "@/components/selections/PochetteSelection";

/** Ce que /api/selections rend pour une sélection (lib/selections.ts, ResumeSelection). */
export type ResumeSelection = {
  cle: string;
  type: "mix" | "decouvertes" | "radar";
  rang: number;
  titre: string;
  description: string;
  genre?: string;
  couverture?: string;
  nombre: number;
};

/** Les titres d'une sélection, pour la lancer depuis sa carte ou sa page. */
export async function titresDeLaSelection(cle: string): Promise<PlayableSong[]> {
  const res = await fetch(`/api/selections/${cle}`);
  if (!res.ok) throw new Error();
  const { titres } = (await res.json()) as { titres: PlayableSong[] };
  return titres;
}

/** La source de lecture d'une sélection : une playlist, à l'identifiant distinct de toute playlist réelle. */
export function sourceDeLaSelection(s: Pick<ResumeSelection, "cle" | "titre">): NonNullable<PlaySource> {
  return { type: "playlist", label: s.titre, id: `selection:${s.cle}` };
}

export function CarteSelection({ s, personnel }: { s: ResumeSelection; personnel: boolean }) {
  const { playSource } = usePlayer();
  const source = sourceDeLaSelection(s);
  return (
    <Link
      href={`/selection/${s.cle}`}
      prefetch={false}
      className="group block w-40 shrink-0 rounded-lg p-2 transition-colors duration-200 hover:bg-ink/[0.06] sm:w-44 lg:w-48"
    >
      <div className="relative shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
        <PochetteSelection s={{ ...s, personnel }} />
        <BoutonLectureCarte
          titres={() => titresDeLaSelection(s.cle)}
          source={source}
          enCours={playSource?.type === "playlist" && playSource.id === source.id}
          libelle={s.titre}
        />
      </div>
      <p className="mt-2.5 truncate text-sm font-semibold text-ink">{s.titre}</p>
      <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-ink-muted">{s.description}</p>
    </Link>
  );
}
