"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CalendarX2, Plus, Search } from "lucide-react";
import { useToast } from "@/context/ToastProvider";
import { useSiteConfig, useFuseauHoraire } from "@/context/SiteConfigProvider";
import { readApiError } from "@/lib/readApiError";
import { EVENT_CATEGORIES, libelleCategorie } from "@/lib/evenements";
import type { EventItem } from "@/components/events/types";
import { EventRow, EventRowSkeleton } from "@/components/events/EventRow";
import { EventPosterRow } from "@/components/events/EventPosterRow";
import { ANePasManquer, CalendrierEvenements, CarteOrganiser } from "@/components/events/EventSidebar";
import { getEventTimeStatus } from "@/components/events/eventStatus";
import { cleJour } from "@/components/events/eventPresentation";
import { PageSections } from "@/components/home/PageSections";

type Tri = "date" | "populaires" | "recents";

const TRIS: { value: Tri; label: string }[] = [
  { value: "date", label: "Les plus proches" },
  { value: "populaires", label: "Les plus suivis" },
  { value: "recents", label: "Les plus récents" },
];

/** Nombre d'évènements ajoutés à chaque « Charger plus ». */
const PAR_PAGE = 6;

export default function EventsPage() {
  const { data: session } = useSession();
  const pushToast = useToast();
  const { siteName } = useSiteConfig();
  const fuseau = useFuseauHoraire();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [interestedIds, setInterestedIds] = useState<Set<string>>(new Set());
  const [chargement, setChargement] = useState(true);
  const [peutCreer, setPeutCreer] = useState(false);

  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState<string>("");
  const [tri, setTri] = useState<Tri>("date");
  const [jourSelectionne, setJourSelectionne] = useState<string | null>(null);
  const [visibles, setVisibles] = useState(PAR_PAGE);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const res = await fetch("/api/events");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEvents(data.events);
      setInterestedIds(new Set<string>(data.interestedIds ?? []));
    } catch {
      pushToast("error", "Impossible de charger les évènements.");
    } finally {
      setChargement(false);
    }
  }, [pushToast]);

  useEffect(() => {
    charger();
  }, [charger]);

  useEffect(() => {
    async function verifierDroit() {
      if (session?.user?.role === "admin") {
        setPeutCreer(true);
        return;
      }
      if (session?.user?.role === "artist") {
        const res = await fetch("/api/artist/me");
        if (res.ok) {
          const data = await res.json();
          setPeutCreer(Boolean(data.artist?.eventPublishingAuthorized));
        }
      }
    }
    verifierDroit();
  }, [session]);

  // Tout changement de filtre ramène à la première fournée : rester à
  // « 24 affichés » après avoir changé de catégorie n'aurait aucun sens.
  useEffect(() => {
    setVisibles(PAR_PAGE);
  }, [recherche, categorie, tri, jourSelectionne]);

  async function basculerInteret(id: string) {
    if (!session) {
      pushToast("info", "Connecte-toi pour suivre un évènement.");
      return;
    }

    // Bascule optimiste : le cœur répond tout de suite, et revient en
    // arrière si le serveur refuse.
    const etaitInteresse = interestedIds.has(id);
    setInterestedIds((prev) => {
      const suivant = new Set(prev);
      if (etaitInteresse) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });

    try {
      const res = await fetch(`/api/events/${id}/interet`, { method: "POST" });
      if (!res.ok) throw new Error(await readApiError(res, "Action impossible."));
      const data = await res.json();
      setEvents((prev) =>
        prev.map((e) => (e._id === id ? { ...e, interestedCount: data.interestedCount } : e))
      );
    } catch (err) {
      setInterestedIds((prev) => {
        const suivant = new Set(prev);
        if (etaitInteresse) suivant.add(id);
        else suivant.delete(id);
        return suivant;
      });
      pushToast("error", err instanceof Error ? err.message : "Action impossible.");
    }
  }

  const comptesParCategorie = useMemo(() => {
    const comptes = new Map<string, number>();
    for (const event of events) {
      if (!event.category) continue;
      comptes.set(event.category, (comptes.get(event.category) ?? 0) + 1);
    }
    return comptes;
  }, [events]);

  const filtres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return events
      .filter((event) => (categorie ? event.category === categorie : true))
      .filter((event) => (jourSelectionne ? cleJour(event.date, fuseau) === jourSelectionne : true))
      .filter((event) => {
        if (!terme) return true;
        return (
          event.title.toLowerCase().includes(terme) ||
          event.location.toLowerCase().includes(terme) ||
          (event.city ?? "").toLowerCase().includes(terme) ||
          (event.artist?.stageName ?? "").toLowerCase().includes(terme)
        );
      })
      .sort((a, b) => {
        if (tri === "populaires") return (b.interestedCount ?? 0) - (a.interestedCount ?? 0);
        if (tri === "recents") return b._id.localeCompare(a._id);
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
  }, [events, categorie, jourSelectionne, recherche, tri, fuseau]);

  // À ne pas manquer : les prochains, quels que soient les filtres en cours
  // — c'est un rappel, pas un résultat de recherche.
  const imminents = useMemo(
    () =>
      events
        .filter((e) => getEventTimeStatus(e.date) !== "past")
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 4),
    [events]
  );

  const populaires = useMemo(
    () =>
      [...events]
        .filter((e) => (e.interestedCount ?? 0) > 0)
        .sort((a, b) => (b.interestedCount ?? 0) - (a.interestedCount ?? 0))
        .slice(0, 12),
    [events]
  );

  const affiches = filtres.slice(0, visibles);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-8 md:px-10 md:py-10">
      <section className="relative mb-7 overflow-hidden rounded-xl2 bg-[#0b1020] px-6 py-10 md:px-10 md:py-14">
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-accent/25 via-transparent to-transparent" />

        <div className="relative">
          <h1 className="font-display text-3xl text-white md:text-4xl">Évènements</h1>
          <p className="mt-2 max-w-xl text-sm text-white/70">
            Concerts, festivals et rencontres annoncés sur {siteName}.
          </p>

          <div className="relative mt-6 max-w-lg">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/50" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un évènement, un lieu..."
              aria-label="Rechercher un évènement"
              className="w-full rounded-full border border-white/15 bg-white/10 py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/50 outline-none backdrop-blur-sm transition-colors focus:border-accent"
            />
          </div>
        </div>
      </section>

      <div className="mb-7 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setCategorie("")}
          aria-pressed={categorie === ""}
          className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
            categorie === "" ? "bg-accent text-base" : "border border-border text-ink-muted hover:border-accent hover:text-ink"
          }`}
        >
          Toutes ({events.length})
        </button>

        {/* Une catégorie sans aucun évènement n'est pas proposée : le
            bouton n'aurait mené qu'à une liste vide. */}
        {EVENT_CATEGORIES.filter((c) => (comptesParCategorie.get(c) ?? 0) > 0).map((valeur) => (
          <button
            key={valeur}
            type="button"
            onClick={() => setCategorie(valeur)}
            aria-pressed={categorie === valeur}
            className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
              categorie === valeur
                ? "bg-accent text-base"
                : "border border-border text-ink-muted hover:border-accent hover:text-ink"
            }`}
          >
            {libelleCategorie(valeur)} ({comptesParCategorie.get(valeur)})
          </button>
        ))}

        {peutCreer && (
          <Link
            href="/evenements/nouveau"
            className="ml-auto flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-medium text-base transition-colors hover:bg-accent-hover"
          >
            <Plus size={14} /> Créer un évènement
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold">
              {jourSelectionne ? "Évènements du jour choisi" : "Tous les évènements"}
              <span className="ml-2 text-sm font-normal text-ink-muted">{filtres.length}</span>
            </h2>

            <label className="flex items-center gap-2 text-xs text-ink-muted">
              Trier
              <select
                value={tri}
                onChange={(e) => setTri(e.target.value as Tri)}
                className="rounded-xl border border-border bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-accent"
              >
                {TRIS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {chargement && (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <EventRowSkeleton key={i} />
              ))}
            </div>
          )}

          {!chargement && filtres.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-xl2 border border-dashed border-border py-16 text-center">
              <CalendarX2 size={28} className="text-ink-muted" />
              <p className="text-sm text-ink-muted">
                {events.length === 0
                  ? "Aucun évènement pour l'instant."
                  : "Aucun évènement ne correspond à cette recherche."}
              </p>
            </div>
          )}

          {!chargement && affiches.length > 0 && (
            <div className="space-y-4">
              {affiches.map((event) => (
                <EventRow
                  key={event._id}
                  event={event}
                  interesse={interestedIds.has(event._id)}
                  onToggleInteret={basculerInteret}
                  canManage={
                    session?.user?.role === "admin" || session?.user?.id === event.createdBy
                  }
                  onDeleted={(id) => setEvents((prev) => prev.filter((e) => e._id !== id))}
                />
              ))}
            </div>
          )}

          {!chargement && filtres.length > visibles && (
            <button
              type="button"
              onClick={() => setVisibles((n) => n + PAR_PAGE)}
              className="mt-5 w-full rounded-xl border border-border py-3 text-sm font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"
            >
              Charger plus ({filtres.length - visibles} restants)
            </button>
          )}
        </div>

        {/* `lg:sticky` : la colonne suit le défilement de la liste, souvent
            bien plus longue qu'elle. */}
        <aside className="space-y-4 lg:sticky lg:top-6">
          <ANePasManquer events={imminents} />
          <CalendrierEvenements
            events={events}
            jourSelectionne={jourSelectionne}
            onSelectionner={setJourSelectionne}
          />
          <CarteOrganiser peutCreer={peutCreer} />
        </aside>
      </div>

      {populaires.length > 0 && (
        <div className="mt-8">
          <EventPosterRow
            events={populaires}
            interestedIds={interestedIds}
            onToggleInteret={basculerInteret}
          />
        </div>
      )}

      {/* Sections éditoriales pilotées depuis l'administration. */}
      <PageSections page="library" className="mt-10" />
    </div>
  );
}
