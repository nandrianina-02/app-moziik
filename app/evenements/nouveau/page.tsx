"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CalendarX2 } from "lucide-react";
import { SkeletonForm } from "@/components/ui/Skeleton";
import { EventForm } from "@/components/events/EventForm";

/**
 * Création d'un évènement, en pleine page.
 *
 * Une modale ne suffisait plus : la fiche compte désormais une billetterie,
 * un déroulé, une galerie et une affiche à cadrer. Même formulaire qu'à la
 * modification, pour que ce qui est saisi ici se retrouve exactement là-bas.
 */
export default function NouvelEvenementPage() {
  const { data: session, status } = useSession();
  const [autorise, setAutorise] = useState<boolean | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (session?.user?.role === "admin") {
      setAutorise(true);
      return;
    }
    if (session?.user?.role !== "artist") {
      setAutorise(false);
      return;
    }

    // Un artiste ne publie d'évènement que si l'administration l'y a
    // autorisé ; l'API le revérifie, cette lecture évite seulement de lui
    // faire remplir un formulaire qui serait refusé.
    let annule = false;
    fetch("/api/artist/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!annule) setAutorise(Boolean(data?.artist?.eventPublishingAuthorized));
      })
      .catch(() => {
        if (!annule) setAutorise(false);
      });
    return () => {
      annule = true;
    };
  }, [session, status]);

  if (status === "loading" || autorise === null) return <SkeletonForm fields={6} />;

  if (!autorise) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
        <CalendarX2 size={30} className="text-ink-muted" />
        <p className="text-sm text-ink-muted">
          Seuls les administrateurs et les artistes autorisés peuvent publier un évènement.
        </p>
        <Link
          href="/evenements"
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
        >
          Voir les évènements
        </Link>
      </div>
    );
  }

  return <EventForm mode="create" peutChoisirStatut={session?.user?.role === "admin"} />;
}
