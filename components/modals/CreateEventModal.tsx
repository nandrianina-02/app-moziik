"use client";

import { useState } from "react";
import { FormField } from "@/components/ui/FormField";
import { useToast } from "@/context/ToastProvider";
import { uploadToCloudinaryClient } from "@/lib/cloudinaryClient";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { EVENT_CATEGORIES, libelleCategorie } from "@/lib/evenements";

export function CreateEventModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const pushToast = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [category, setCategory] = useState("");
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
          endDate: endDate || undefined,
          category: category || undefined,
          ticketUrl: ticketUrl || undefined,
          price: price ? Number(price) : undefined,
          coverUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      pushToast(
        "success",
        data.event.status === "published"
          ? "Évènement publié. Complète sa fiche pour le mettre en valeur."
          : "Évènement envoyé pour validation."
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
    <ModalSheet
      titre="Créer un évènement"
      largeur="sm:max-w-md"
      onClose={onClose}
      pied={
        <button
          type="submit"
          form="form-nouvel-evenement"
          disabled={submitting}
          className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-base hover:bg-accent-hover disabled:opacity-60"
        >
          {submitting ? "Envoi..." : "Créer l'évènement"}
        </button>
      }
    >
      <form id="form-nouvel-evenement" onSubmit={handleSubmit} className="space-y-4">
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

          <label className="block">
            <span className="mb-1.5 block text-sm text-ink-muted">Catégorie</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-border bg-base px-4 py-2.5 text-sm outline-none focus:border-accent"
            >
              <option value="">Non précisée</option>
              {EVENT_CATEGORIES.map((valeur) => (
                <option key={valeur} value={valeur}>
                  {libelleCategorie(valeur)}
                </option>
              ))}
            </select>
          </label>

          <FormField label="Lieu" required value={location} onChange={(e) => setLocation(e.target.value)} />
          <FormField label="Début" type="datetime-local" required value={date} onChange={(e) => setDate(e.target.value)} />
          <FormField label="Fin (optionnel)" type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <FormField label="Lien billetterie (optionnel)" value={ticketUrl} onChange={(e) => setTicketUrl(e.target.value)} />
          <FormField label="Prix (optionnel)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />

          <label className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 cursor-pointer text-sm text-ink-muted hover:border-accent">
            {coverFile ? coverFile.name : "Choisir une affiche (optionnel)"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
          </label>

      </form>
    </ModalSheet>
  );
}
