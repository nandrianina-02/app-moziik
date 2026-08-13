"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { FormField } from "@/components/ui/FormField";
import { useToast } from "@/context/ToastProvider";
import { uploadToCloudinaryClient } from "@/lib/cloudinaryClient";

export function CreateAlbumModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const pushToast = useToast();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"album" | "ep" | "single">("album");
  const [releaseDate, setReleaseDate] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!coverFile) {
      pushToast("error", "Ajoute une pochette.");
      return;
    }
    setSubmitting(true);
    try {
      const { url } = await uploadToCloudinaryClient(coverFile, "covers");

      const res = await fetch("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          type,
          coverUrl: url,
          releaseDate: releaseDate || new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      pushToast("success", "Album créé.");
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
        className="w-full max-w-sm rounded-xl2 border border-border bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-display">Nouvel album</h2>
          <button onClick={onClose} aria-label="Fermer" className="text-ink-muted hover:text-ink">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Titre" required value={title} onChange={(e) => setTitle(e.target.value)} />

          <label className="block">
            <span className="text-sm text-ink-muted mb-1.5 block">Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="w-full rounded-xl border border-border bg-base px-4 py-2.5 text-sm outline-none focus:border-accent"
            >
              <option value="album">Album</option>
              <option value="ep">EP</option>
              <option value="single">Single</option>
            </select>
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 cursor-pointer text-sm text-ink-muted hover:border-accent">
            {coverFile ? coverFile.name : "Choisir la pochette"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
          </label>

          <FormField
            label="Date de sortie (laisser vide pour maintenant)"
            type="datetime-local"
            value={releaseDate}
            onChange={(e) => setReleaseDate(e.target.value)}
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-base hover:bg-accent-hover disabled:opacity-60"
          >
            {submitting ? "Création..." : "Créer l'album"}
          </button>
        </form>
      </div>
    </div>
  );
}
