"use client";

import { useEffect, useState } from "react";
import { Check, X, Pencil, Trash2, MapPin, CalendarDays } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { AdminCardsSkeleton } from "@/components/admin/AdminSkeleton";
import { IconActionButton, IconActionLink } from "@/components/admin/IconActionButton";
import { AdminItemGrid } from "@/components/admin/AdminItemGrid";
import { useToast } from "@/context/ToastProvider";

type AdminEvent = {
  _id: string;
  title: string;
  coverUrl?: string;
  location: string;
  date: string;
  status: "pending" | "published" | "rejected";
  artist?: { stageName: string };
};

const statusFilters: { value: string; label: string }[] = [
  { value: "", label: "Tous" },
  { value: "pending", label: "En attente" },
  { value: "published", label: "Publiés" },
  { value: "rejected", label: "Rejetés" },
];

const statusLabel: Record<AdminEvent["status"], string> = {
  pending: "En attente",
  published: "Publié",
  rejected: "Rejeté",
};
const statusColor: Record<AdminEvent["status"], string> = {
  pending: "text-ink-muted",
  published: "text-verified",
  rejected: "text-accent",
};

export default function AdminEventsPage() {
  const pushToast = useToast();
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/admin/events${params}`);
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
  }, [statusFilter]);

  async function moderate(id: string, decision: "approve" | "reject") {
    const res = await fetch(`/api/admin/events/${id}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    if (!res.ok) {
      pushToast("error", "L'action a échoué.");
      return;
    }
    pushToast("success", decision === "approve" ? "Évènement publié." : "Évènement rejeté.");
    load();
  }

  async function deleteEvent(id: string) {
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
    if (!res.ok) {
      pushToast("error", "La suppression a échoué.");
      return;
    }
    pushToast("success", "Évènement supprimé.");
    setEvents((prev) => prev.filter((e) => e._id !== id));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6">
        {statusFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition-colors ${
              statusFilter === f.value
                ? "bg-accent text-base border-accent"
                : "border-border text-ink-muted hover:border-accent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <AdminCardsSkeleton count={6} cols={2} />}

      <div>
        {!loading && events.length === 0 && (
          <p className="text-sm text-ink-muted">Aucun évènement pour ce filtre.</p>
        )}

        <AdminItemGrid cols={2}>
          {events.map((event) => (
            <div
              key={event._id}
              className="flex flex-wrap items-center gap-3 rounded-xl2 border border-border bg-surface px-4 py-3.5"
            >
              <SafeImage src={event.coverUrl} alt={event.title} width={44} height={44} className="rounded-lg object-cover shrink-0" />
              <div className="flex-1 min-w-[160px]">
                <p className="text-sm font-medium truncate">{event.title}</p>
                <p className="flex items-center gap-3 text-xs text-ink-muted mt-0.5">
                  <span className="flex items-center gap-1"><MapPin size={11} /> {event.location}</span>
                  <span className="flex items-center gap-1"><CalendarDays size={11} /> {new Date(event.date).toLocaleDateString("fr-FR")}</span>
                </p>
                {event.artist && <p className="text-xs text-ink-muted">Par {event.artist.stageName}</p>}
                <p className={`text-[11px] mt-0.5 ${statusColor[event.status]}`}>{statusLabel[event.status]}</p>
              </div>

              <div className="flex items-center gap-2">
                {event.status === "pending" && (
                  <>
                    <IconActionButton icon={Check} label="Approuver" tone="success" onClick={() => moderate(event._id, "approve")} />
                    <IconActionButton icon={X} label="Rejeter" tone="danger" onClick={() => moderate(event._id, "reject")} />
                  </>
                )}
                <IconActionLink icon={Pencil} label="Modifier" href={`/evenements/${event._id}/modifier`} />
                <IconActionButton icon={Trash2} label="Supprimer" onClick={() => deleteEvent(event._id)} />
              </div>
            </div>
          ))}
        </AdminItemGrid>
      </div>
    </div>
  );
}
