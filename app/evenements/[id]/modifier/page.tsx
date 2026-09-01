"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { SkeletonForm } from "@/components/ui/Skeleton";
import { useToast } from "@/context/ToastProvider";
import { EventForm } from "@/components/events/EventForm";
import type { EventDetail } from "@/components/events/detail/types";

/**
 * Modification d'un évènement.
 *
 * La page ne fait que charger la fiche et vérifier qui la demande : tout le
 * formulaire vit dans `EventForm`, partagé avec la création.
 */
export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session, status } = useSession();
  const pushToast = useToast();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    async function charger() {
      try {
        const res = await fetch(`/api/events/${id}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setEvent(data.event);
      } catch {
        pushToast("error", "Impossible de charger cet évènement.");
      } finally {
        setChargement(false);
      }
    }
    charger();
  }, [id, pushToast]);

  if (status === "loading" || chargement) return <SkeletonForm fields={6} />;

  if (!event) {
    return <p className="px-6 py-10 text-sm text-ink-muted">Cet évènement est introuvable.</p>;
  }

  const peutGerer = session?.user?.role === "admin" || session?.user?.id === event.createdBy;
  if (!peutGerer) {
    return <p className="px-6 py-10 text-sm text-ink-muted">Tu n&apos;as pas accès à cette page.</p>;
  }

  return (
    <EventForm mode="edit" initial={event} peutChoisirStatut={session?.user?.role === "admin"} />
  );
}
