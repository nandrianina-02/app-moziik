"use client";

import { useState } from "react";
import { FormField } from "@/components/ui/FormField";
import { useToast } from "@/context/ToastProvider";
import { uploadToCloudinaryClient } from "@/lib/cloudinaryClient";
import { ModalSheet } from "@/components/ui/ModalSheet";

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
    <ModalSheet
      titre="Nouvel album"
      largeur="sm:max-w-sm"
      onClose={onClose}
      pied={
        // Hors de la zone défilante mais toujours rattaché au formulaire
        // par `form=` : le bouton reste visible sans faire défiler.
        <button
          type="submit"
          form="form-nouvel-album"
          disabled={submitting}
          className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-base hover:bg-accent-hover disabled:opacity-60"
        >
          {submitting ? "Création..." : "Créer l'album"}
        </button>
      }
    >
      <form id="form-nouvel-album" onSubmit={handleSubmit} className="space-y-4">
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

      </form>
    </ModalSheet>
  );
}
