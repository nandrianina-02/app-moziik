"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Search, CalendarRange, CalendarClock, Radio, CalendarCheck2, CalendarX2 } from "lucide-react";
import { CreateEventModal } from "@/components/modals/CreateEventModal";
import { useToast } from "@/context/ToastProvider";
import { EventCard, type EventItem } from "@/components/events/EventCard";
import { EventCardSkeleton } from "@/components/events/EventCardSkeleton";
import { EventStatCard } from "@/components/events/EventStatCard";
import { getEventTimeStatus } from "@/components/events/eventStatus";

type TabValue = "all" | "upcoming" | "live" | "past";

const tabs: { value: TabValue; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "upcoming", label: "À venir" },
  { value: "live", label: "En cours" },
  { value: "past", label: "Passés" },
];

export default function EventsPage() {
  const { data: session } = useSession();
  const pushToast = useToast();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [canCreate, setCanCreate] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState<TabValue>("all");
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/events");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEvents(data.events);
    } catch {
      pushToast("error", "Impossible de charger les évènements.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function checkPermission() {
      if (session?.user?.role === "admin") {
        setCanCreate(true);
        return;
      }
      if (session?.user?.role === "artist") {
        const res = await fetch("/api/artist/me");
        if (res.ok) {
          const data = await res.json();
          setCanCreate(!!data.artist?.eventPublishingAuthorized);
        }
      }
    }
    checkPermission();
  }, [session]);

  const counts = useMemo(() => {
    const c = { upcoming: 0, live: 0, past: 0 };
    for (const event of events) {
      const status = getEventTimeStatus(event.date);
      c[status]++;
    }
    return c;
  }, [events]);

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events
      .filter((event) => (tab === "all" ? true : getEventTimeStatus(event.date) === tab))
      .filter((event) => {
        if (!q) return true;
        return (
          event.title.toLowerCase().includes(q) ||
          event.location.toLowerCase().includes(q) ||
          event.artist?.stageName.toLowerCase().includes(q)
        );
      });
  }, [events, tab, query]);

  function handleDeleted(id: string) {
    setEvents((prev) => prev.filter((e) => e._id !== id));
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-8 md:px-10 md:py-10">
      <header className="mb-7 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-display md:text-3xl">Évènements</h1>
          <p className="mt-1 text-sm text-ink-muted">Découvre et gère les évènements de la plateforme.</p>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un évènement..."
              className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-accent sm:w-64"
            />
          </div>

          {canCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
            >
              <Plus size={16} /> Créer un évènement
            </button>
          )}
        </div>
      </header>

      <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <EventStatCard
          icon={CalendarRange}
          iconClassName="bg-accent/10 text-accent"
          label="Total évènements"
          value={events.length}
          hint="Sur la plateforme"
        />
        <EventStatCard
          icon={CalendarClock}
          iconClassName="bg-accent/10 text-accent"
          label="À venir"
          value={counts.upcoming}
          hint="Prochainement"
        />
        <EventStatCard
          icon={Radio}
          iconClassName="bg-verified/10 text-verified"
          label="En cours"
          value={counts.live}
          hint="En direct maintenant"
        />
        <EventStatCard
          icon={CalendarCheck2}
          iconClassName="bg-ink-muted/10 text-ink-muted"
          label="Passés"
          value={counts.past}
          hint="Évènements terminés"
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              tab === t.value
                ? "bg-accent text-base"
                : "border border-border text-ink-muted hover:border-accent hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!loading && filteredEvents.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl2 border border-dashed border-border py-16 text-center">
          <CalendarX2 size={28} className="text-ink-muted" />
          <p className="text-sm text-ink-muted">
            {events.length === 0
              ? "Aucun évènement pour l'instant."
              : "Aucun évènement ne correspond à ta recherche."}
          </p>
        </div>
      )}

      {!loading && filteredEvents.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event) => {
            const canManage =
              session?.user?.role === "admin" || session?.user?.id === event.createdBy;
            return <EventCard key={event._id} event={event} canManage={canManage} onDeleted={handleDeleted} />;
          })}
        </div>
      )}

      {showCreate && <CreateEventModal onClose={() => setShowCreate(false)} onCreated={load} />}
    </div>
  );
}
