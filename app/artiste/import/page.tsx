"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Music4 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ImportWorkbench } from "@/components/import/ImportWorkbench";
import type { ArtisteOption } from "@/components/import/types";

/**
 * Import par lot, côté artiste.
 *
 * Le même poste que l'administration, réduit à ce qui le concerne : les
 * morceaux lui sont rattachés d'office, les doublons ne sont cherchés que
 * dans son propre catalogue, et ses envois deviennent des brouillons
 * soumis à validation.
 *
 * Il n'avait jusqu'ici que l'envoi unitaire, un morceau à la fois — une
 * séance entière d'album se déposait en autant d'allers-retours.
 */
export default function ArtistImportPage() {
  const [profil, setProfil] = useState<ArtisteOption | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    fetch("/api/artist/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const artiste = data?.artist;
        setProfil(
          artiste
            ? { _id: artiste._id, stageName: artiste.stageName, verified: artiste.verified }
            : null
        );
      })
      .catch(() => setProfil(null))
      .finally(() => setChargement(false));
  }, []);

  if (chargement) {
    return (
      <div className="mx-auto w-full max-w-[1400px] space-y-4 px-6 py-8 md:px-10 md:py-10">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full rounded-xl2" />
      </div>
    );
  }

  if (!profil) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
        <Music4 size={30} className="text-ink-muted" />
        <p className="text-sm text-ink-muted">
          Aucun profil artiste rattaché à ce compte : l&apos;import par lot ne saurait pas à qui
          attribuer les morceaux.
        </p>
        <Link
          href="/artiste/gestion"
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
        >
          Mon espace artiste
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto w-full max-w-[1400px] px-6 pt-8 md:px-10 md:pt-10">
        <Link
          href="/artiste/gestion"
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} /> Mon espace artiste
        </Link>
      </div>

      <ImportWorkbench estAdmin={false} artisteImpose={profil} />
    </div>
  );
}
