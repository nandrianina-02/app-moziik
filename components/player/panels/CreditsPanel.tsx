"use client";

import Link from "next/link";
import { BadgeCheck, Copyright, Fingerprint, Mic2, Music4, PenLine, Sliders, Users } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import type { SongDetails } from "@/components/player/hooks/useSongDetails";
import type { PlayableSong } from "@/context/PlayerProvider";

/**
 * Onglet « Crédits ».
 *
 * Les artistes en featuring portent un état de confirmation en base : un
 * crédit non confirmé est affiché comme tel plutôt que passé sous silence
 * ou présenté comme acquis — c'est la même règle que sur la page du son.
 */

function LigneCredit({
  icon: Icon,
  role,
  children,
}: {
  icon: typeof Mic2;
  role: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-surface/60 px-3.5 py-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
        <Icon size={15} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{role}</span>
        <span className="mt-0.5 block text-sm text-ink">{children}</span>
      </span>
    </div>
  );
}

export function CreditsPanel({ song, details }: { song: PlayableSong; details: SongDetails | null }) {
  const artiste = details?.artist ?? song.artist;
  const featuring = (details?.featuring ?? song.featuring ?? []).filter((f) => f.artist);

  const aQuelqueChose =
    artiste || featuring.length > 0 || details?.composer || details?.producer || details?.copyright || details?.isrc;

  if (!aQuelqueChose) {
    return (
      <p className="rounded-xl2 border border-dashed border-border px-4 py-10 text-center text-sm text-ink-muted">
        Aucun crédit n&apos;a encore été renseigné pour ce titre.
      </p>
    );
  }

  return (
    <div className="space-y-2.5 pb-6">
      {artiste && (
        <Link
          href={`/artiste/${artiste._id}`}
          className="flex items-center gap-3 rounded-xl2 border border-border bg-surface px-3.5 py-3 transition-colors hover:border-accent"
        >
          <SafeImage
            src={(artiste as { coverUrl?: string }).coverUrl}
            alt={artiste.stageName}
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 rounded-full object-cover"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              Artiste principal
            </span>
            <span className="mt-0.5 flex items-center gap-1 truncate text-sm font-medium text-ink">
              {artiste.stageName}
              {artiste.verified && <BadgeCheck size={13} className="shrink-0 text-verified" />}
            </span>
          </span>
        </Link>
      )}

      {featuring.length > 0 && (
        <div className="rounded-xl2 border border-border bg-surface/60 px-3.5 py-3">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
            <Users size={11} /> Featuring
          </span>
          <ul className="mt-2 space-y-1.5">
            {featuring.map((f) => (
              <li key={f.artist!._id} className="flex items-center justify-between gap-2">
                <Link
                  href={`/artiste/${f.artist!._id}`}
                  className="flex min-w-0 items-center gap-1 truncate text-sm text-ink transition-colors hover:text-accent"
                >
                  {f.artist!.stageName}
                  {f.artist!.verified && <BadgeCheck size={12} className="shrink-0 text-verified" />}
                </Link>
                {f.confirmed ? (
                  <span className="shrink-0 rounded-full bg-verified/12 px-2 py-0.5 text-[10px] font-semibold text-verified">
                    Confirmé
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-ink-muted">
                    En attente
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {details?.composer && (
        <LigneCredit icon={PenLine} role="Composition">
          {details.composer}
        </LigneCredit>
      )}
      {details?.producer && (
        <LigneCredit icon={Sliders} role="Production">
          {details.producer}
        </LigneCredit>
      )}
      {details?.musicalKey && (
        <LigneCredit icon={Music4} role="Tonalité">
          {details.musicalKey}
          {details.bpm ? ` · ${details.bpm} BPM` : ""}
        </LigneCredit>
      )}
      {details?.isrc && (
        <LigneCredit icon={Fingerprint} role="Code ISRC">
          <span className="font-mono text-xs">{details.isrc}</span>
        </LigneCredit>
      )}
      {details?.copyright && (
        <LigneCredit icon={Copyright} role="Droits">
          {details.copyright}
        </LigneCredit>
      )}
    </div>
  );
}
