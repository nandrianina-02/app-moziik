"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, ChevronLeft, ChevronRight, Radio } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { useFuseauHoraire } from "@/context/SiteConfigProvider";
import { getEventTimeStatus } from "@/components/events/eventStatus";
import { cleJour, heure, jourLong, moisEtAnnee } from "@/components/events/eventPresentation";
import type { EventItem } from "@/components/events/types";

/** Les blocs de la colonne de droite de la page évènements. */

function CarteLaterale({
  titre,
  lien,
  libelleLien,
  children,
}: {
  titre: string;
  lien?: string;
  libelleLien?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl2 border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{titre}</h2>
        {lien && (
          <Link href={lien} className="shrink-0 text-xs text-accent hover:underline">
            {libelleLien}
          </Link>
        )}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

const ETIQUETTE = {
  upcoming: { label: "À venir", classe: "bg-accent/10 text-accent" },
  live: { label: "En cours", classe: "bg-verified/10 text-verified" },
  past: { label: "Passé", classe: "bg-ink-muted/10 text-ink-muted" },
};

/**
 * À ne pas manquer : les prochains évènements, les plus proches d'abord.
 *
 * Pas de sélection éditoriale cachée — c'est bien l'imminence qui fait
 * qu'on risque de les manquer.
 */
export function ANePasManquer({ events }: { events: EventItem[] }) {
  const fuseau = useFuseauHoraire();
  if (events.length === 0) return null;

  return (
    <CarteLaterale titre="À ne pas manquer" lien="/evenements" libelleLien="Tout voir">
      <ul className="space-y-3">
        {events.map((event) => {
          const statut = getEventTimeStatus(event.date);
          const etiquette = ETIQUETTE[statut];
          return (
            <li key={event._id}>
              <Link href={`/evenements/${event._id}`} className="group flex items-start gap-3">
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-base">
                  <SafeImage
                    src={event.coverUrl}
                    alt=""
                    width={56}
                    height={56}
                    className="h-full w-full object-cover"
                  />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium transition-colors group-hover:text-accent">
                    {event.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    {jourLong(event.date, fuseau)} • {heure(event.date, fuseau)}
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-ink-muted">{event.location}</span>
                    <span
                      className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${etiquette.classe}`}
                    >
                      {statut === "live" && <Radio size={9} className="animate-pulse" />}
                      {etiquette.label}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </CarteLaterale>
  );
}

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/**
 * Calendrier du mois, avec un point sous les jours qui portent un
 * évènement. Cliquer un jour filtre la liste ; recliquer le même l'annule.
 *
 * Les jours sont regroupés dans le fuseau du site, pas celui du
 * navigateur : sinon une soirée du 24 à 23 h se rangerait au 25 pour qui
 * la consulte depuis un fuseau en avance.
 */
export function CalendrierEvenements({
  events,
  jourSelectionne,
  onSelectionner,
}: {
  events: EventItem[];
  jourSelectionne: string | null;
  onSelectionner: (jour: string | null) => void;
}) {
  const fuseau = useFuseauHoraire();
  const aujourdhui = useMemo(() => new Date(), []);
  const [curseur, setCurseur] = useState(() => ({
    annee: aujourdhui.getFullYear(),
    mois: aujourdhui.getMonth(),
  }));

  const joursAvecEvenement = useMemo(() => {
    const compte = new Map<string, number>();
    for (const event of events) {
      const cle = cleJour(event.date, fuseau);
      compte.set(cle, (compte.get(cle) ?? 0) + 1);
    }
    return compte;
  }, [events, fuseau]);

  const cases = useMemo(() => {
    const premier = new Date(curseur.annee, curseur.mois, 1);
    const nbJours = new Date(curseur.annee, curseur.mois + 1, 0).getDate();
    // getDay() rend 0 pour dimanche ; la semaine française commence lundi.
    const decalage = (premier.getDay() + 6) % 7;

    const grille: (number | null)[] = Array.from({ length: decalage }, () => null);
    for (let jour = 1; jour <= nbJours; jour++) grille.push(jour);
    return grille;
  }, [curseur]);

  function cleDe(jour: number): string {
    const mois = String(curseur.mois + 1).padStart(2, "0");
    return `${curseur.annee}-${mois}-${String(jour).padStart(2, "0")}`;
  }

  const cleAujourdhui = cleJour(aujourdhui, fuseau);

  function changerMois(pas: number) {
    setCurseur(({ annee, mois }) => {
      const date = new Date(annee, mois + pas, 1);
      return { annee: date.getFullYear(), mois: date.getMonth() };
    });
  }

  return (
    <CarteLaterale titre="Calendrier">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => changerMois(-1)}
          aria-label="Mois précédent"
          className="grid h-7 w-7 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-base hover:text-ink"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="text-sm font-medium capitalize">{moisEtAnnee(curseur.annee, curseur.mois)}</span>
        <button
          type="button"
          onClick={() => changerMois(1)}
          aria-label="Mois suivant"
          className="grid h-7 w-7 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-base hover:text-ink"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {JOURS.map((jour) => (
          <span key={jour} className="py-1 text-[11px] text-ink-muted">
            {jour}
          </span>
        ))}

        {cases.map((jour, index) => {
          if (jour === null) return <span key={`v${index}`} />;

          const cle = cleDe(jour);
          const nombre = joursAvecEvenement.get(cle) ?? 0;
          const selectionne = jourSelectionne === cle;

          return (
            <button
              key={cle}
              type="button"
              disabled={nombre === 0}
              onClick={() => onSelectionner(selectionne ? null : cle)}
              aria-pressed={selectionne}
              aria-label={
                nombre === 0
                  ? `${jour} — aucun évènement`
                  : `${jour} — ${nombre} évènement${nombre > 1 ? "s" : ""}`
              }
              className={`relative grid h-8 place-items-center rounded-lg text-xs transition-colors ${
                selectionne
                  ? "bg-accent font-medium text-base"
                  : nombre > 0
                  ? "font-medium text-ink hover:bg-base"
                  : "text-ink-muted/50"
              } ${cle === cleAujourdhui && !selectionne ? "ring-1 ring-inset ring-accent/40" : ""}`}
            >
              {jour}
              {nombre > 0 && !selectionne && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </div>

      {jourSelectionne && (
        <button
          type="button"
          onClick={() => onSelectionner(null)}
          className="mt-3 w-full rounded-lg border border-border py-2 text-xs text-ink-muted transition-colors hover:border-accent hover:text-accent"
        >
          Afficher tous les jours
        </button>
      )}
    </CarteLaterale>
  );
}

/** Appel à publier son propre évènement, pour qui en a le droit. */
export function CarteOrganiser({ peutCreer }: { peutCreer: boolean }) {
  return (
    <section className="rounded-xl2 border border-accent/30 bg-accent/5 p-5">
      <span className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-accent/15 text-accent">
        <CalendarPlus size={18} />
      </span>
      <h2 className="text-sm font-semibold">Organisez votre évènement</h2>
      <p className="mt-1 text-xs leading-relaxed text-ink-muted">
        {peutCreer
          ? "Publiez-le et faites-le découvrir à toute la communauté."
          : "La publication est réservée aux artistes autorisés. Écrivez-nous pour en faire partie."}
      </p>
      <Link
        href={peutCreer ? "/evenements/nouveau" : "/contact"}
        className="mt-4 flex w-full items-center justify-center rounded-xl bg-accent py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
      >
        {peutCreer ? "Créer un évènement" : "Nous contacter"}
      </Link>
    </section>
  );
}
