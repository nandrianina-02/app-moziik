"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FormField } from "@/components/ui/FormField";
import { EqualizerLoader } from "@/components/ui/EqualizerLoader";
import { useToast } from "@/context/ToastProvider";

type EventDetail = {
  _id: string;
  title: string;
  description: string;
  location: string;
  date: string;
  ticketUrl?: string;
  price?: number;
  createdBy: string;
};

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, status } = useSession();
  const pushToast = useToast();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [ticketUrl, setTicketUrl] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/events/${id}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setEvent(data.event);
        setTitle(data.event.title);
        setDescription(data.event.description);
        setLocation(data.event.location);
        setDate(new Date(data.event.date).toISOString().slice(0, 16));
        setTicketUrl(data.event.ticketUrl ?? "");
        setPrice(data.event.price?.toString() ?? "");
      } catch {
        pushToast("error", "Impossible de charger cet évènement.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, pushToast]);

  const canManage =
    session?.user?.role === "admin" || (event && session?.user?.id === event.createdBy);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          location,
          date: new Date(date).toISOString(),
          ticketUrl: ticketUrl || undefined,
          price: price ? Number(price) : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      pushToast("success", "Évènement mis à jour.");
      router.push("/evenements");
    } catch {
      pushToast("error", "La mise à jour a échoué.");
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="py-16 grid place-items-center">
        <EqualizerLoader />
      </div>
    );
  }

  if (!event) {
    return <p className="px-6 py-10 text-sm text-ink-muted">Cet évènement est introuvable.</p>;
  }

  if (!canManage) {
    return <p className="px-6 py-10 text-sm text-ink-muted">Tu n&apos;as pas accès à cette page.</p>;
  }

  return (
    <div className="px-6 py-8 md:px-10 md:py-10 max-w-md">
      <h1 className="text-2xl font-display mb-6">Modifier l&apos;évènement</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Titre" required value={title} onChange={(e) => setTitle(e.target.value)} />

        <label className="block">
          <span className="text-sm text-ink-muted mb-1.5 block">Description</span>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-border bg-base px-4 py-2.5 text-sm outline-none focus:border-accent resize-none"
          />
        </label>

        <FormField label="Lieu" required value={location} onChange={(e) => setLocation(e.target.value)} />
        <FormField label="Date" type="datetime-local" required value={date} onChange={(e) => setDate(e.target.value)} />
        <FormField label="Lien billetterie (optionnel)" value={ticketUrl} onChange={(e) => setTicketUrl(e.target.value)} />
        <FormField label="Prix (optionnel)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-base hover:bg-accent-hover disabled:opacity-60"
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
