"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { FormField } from "@/components/ui/FormField";
import { useToast } from "@/context/ToastProvider";
import { uploadToCloudinaryClient } from "@/lib/cloudinaryClient";

export function CreateEventModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const pushToast = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [ticketUrl, setTicketUrl] = useState("");
  const [price, setPrice] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      let coverUrl: string | undefined;
      if (coverFile) {
        const upload = await uploadToCloudinaryClient(coverFile, "covers");
        coverUrl = upload.url;
      }

      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          location,
          date,
          ticketUrl: ticketUrl || undefined,
          price: price ? Number(price) : undefined,
          coverUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      pushToast(
        "success",
        data.event.status === "published" ? "Évènement publié." : "Évènement envoyé pour validation."
      );
      onCreated();
      onClose();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Échec de la création.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center px-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl2 border border-border bg-surface p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-display">Créer un évènement</h2>
          <button onClick={onClose} aria-label="Fermer" className="text-ink-muted hover:text-ink">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Titre" required value={title} onChange={(e) => setTitle(e.target.value)} />

          <label className="block">
            <span className="text-sm text-ink-muted mb-1.5 block">Description</span>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-border bg-base px-4 py-2.5 text-sm outline-none focus:border-accent resize-none"
            />
          </label>

          <FormField label="Lieu" required value={location} onChange={(e) => setLocation(e.target.value)} />
          <FormField label="Date" type="datetime-local" required value={date} onChange={(e) => setDate(e.target.value)} />
          <FormField label="Lien billetterie (optionnel)" value={ticketUrl} onChange={(e) => setTicketUrl(e.target.value)} />
          <FormField label="Prix (optionnel)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />

          <label className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 cursor-pointer text-sm text-ink-muted hover:border-accent">
            {coverFile ? coverFile.name : "Choisir une affiche (optionnel)"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-base hover:bg-accent-hover disabled:opacity-60"
          >
            {submitting ? "Envoi..." : "Créer l'évènement"}
          </button>
        </form>
      </div>
    </div>
  );
}
