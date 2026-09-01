"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { CalendarPlus, CalendarX2, Pencil } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/context/ToastProvider";
import { readApiError } from "@/lib/readApiError";
import { EventHero } from "@/components/events/detail/EventHero";
import { EventTabs } from "@/components/events/detail/EventTabs";
import {
  SectionAPropos,
  SectionAffiche,
  SectionInfosPratiques,
  SectionLieu,
  SectionProgramme,
  afficheDe,
  sectionsDisponibles,
} from "@/components/events/detail/EventSections";
import { CarteBillets, CarteOrganisateur, CartePartage } from "@/components/events/detail/EventAside";
import type { EventDetail } from "@/components/events/detail/types";

function Chargement() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-8 md:px-10 md:py-10">
      <Skeleton className="h-[420px] w-full rounded-xl2" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-9/12" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl2" />
      </div>
    </div>
  );
}

export function EventDetailClient() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const pushToast = useToast();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [chargement, setChargement] = useState(true);
  const [interetEnCours, setInteretEnCours] = useState(false);

  const charger = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEvent(data.event);
    } catch {
      setEvent(null);
    } finally {
      setChargement(false);
    }
  }, [id]);

  useEffect(() => {
    charger();
  }, [charger]);

  async function basculerInteret() {
    if (!event) return;
    if (!session) {
      pushToast("info", "Connecte-toi pour suivre cet évènement.");
      return;
    }

    setInteretEnCours(true);
    try {
      const res = await fetch(`/api/events/${event._id}/interet`, { method: "POST" });
      if (!res.ok) throw new Error(await readApiError(res, "Action impossible."));
      const data = await res.json();
      setEvent((precedent) =>
        precedent
          ? { ...precedent, viewerInterested: data.interested, interestedCount: data.interestedCount }
          : precedent
      );
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setInteretEnCours(false);
    }
  }

  if (chargement) return <Chargement />;

  if (!event) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
        <CalendarX2 size={30} className="text-ink-muted" />
        <p className="text-sm text-ink-muted">Cet évènement est introuvable ou n&apos;est plus en ligne.</p>
        <Link
          href="/evenements"
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
        >
          Voir tous les évènements
        </Link>
      </div>
    );
  }

  const peutGerer = session?.user?.role === "admin" || session?.user?.id === event.createdBy;
  const sections = sectionsDisponibles(event);
  const affiche = afficheDe(event);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-8 md:px-10 md:py-10">
      {peutGerer && event.status !== "published" && (
        <p className="mb-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          {event.status === "pending"
            ? "Cet évènement attend la validation d'un administrateur : il n'est visible que de toi."
            : "Cet évènement a été refusé et n'est pas publié."}
        </p>
      )}

      <EventHero event={event} onToggleInteret={basculerInteret} interetEnCours={interetEnCours} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div>
          <EventTabs sections={sections} />

          <div className="space-y-8">
            <SectionAPropos event={event} />
            {(event.program ?? []).length > 0 && <SectionProgramme moments={event.program ?? []} />}
            {affiche.length > 0 && <SectionAffiche artistes={affiche} />}
            {(event.practicalInfo ?? []).length > 0 && (
              <SectionInfosPratiques infos={event.practicalInfo ?? []} />
            )}
            <SectionLieu event={event} />
          </div>
        </div>

        {/* Collante à partir de `lg` seulement : en dessous, la colonne
            passe sous le contenu et une position collante l'y figerait. */}
        <aside className="space-y-4 lg:sticky lg:top-6">
          <CarteBillets event={event} />
          <CarteOrganisateur event={event} />
          <CartePartage event={event} />

          {peutGerer && (
            <Link
              href={`/evenements/${event._id}/modifier`}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"
            >
              <Pencil size={14} /> Modifier cet évènement
            </Link>
          )}
        </aside>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-xl2 border border-border bg-accent/5 px-5 py-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
            <CalendarPlus size={18} />
          </span>
          <div>
            <p className="text-sm font-medium">Tu organises un évènement similaire ?</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              Publie-le sur Moziik et touche toute la communauté.
            </p>
          </div>
        </div>

        <Link
          href="/evenements"
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
        >
          Créer un évènement
        </Link>
      </div>
    </div>
  );
}
