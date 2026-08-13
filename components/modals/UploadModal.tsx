"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { X, UploadCloud, Music as MusicIcon, AlertTriangle } from "lucide-react";
import { uploadToCloudinaryClient } from "@/lib/cloudinaryClient";
import { useToast } from "@/context/ToastProvider";
import { FormField } from "@/components/ui/FormField";
import { FeaturingPicker } from "@/components/modals/FeaturingPicker";
import { ArtistSinglePicker } from "@/components/modals/ArtistSinglePicker";

const GENRES = ["Afrobeat", "Salegy", "Hip-hop", "R&B", "Pop", "Zouk", "Reggae", "Autre"];

type ArtistOption = { _id: string; stageName: string; verified?: boolean };

export function UploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const pushToast = useToast();
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState(GENRES[0]);
  const [explicit, setExplicit] = useState(false);
  const [releaseDate, setReleaseDate] = useState("");
  const [featuring, setFeaturing] = useState<ArtistOption[]>([]);
  const [targetArtist, setTargetArtist] = useState<ArtistOption | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Le titre est requis.");
      return;
    }
    if (!audioFile || !coverFile) {
      setError("Ajoute un fichier audio et une pochette.");
      return;
    }
    if (isAdmin && !targetArtist) {
      setError("Choisis l'artiste pour qui tu publies ce son.");
      return;
    }

    setSubmitting(true);
    try {
      const [audioUpload, coverUpload] = await Promise.all([
        uploadToCloudinaryClient(audioFile, "songs", setProgress),
        uploadToCloudinaryClient(coverFile, "covers"),
      ]);

      const res = await fetch("/api/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          genre,
          explicit,
          audioUrl: audioUpload.url,
          coverUrl: coverUpload.url,
          duration: Math.round(audioUpload.duration ?? 0),
          releaseDate: releaseDate || new Date().toISOString(),
          featuringIds: featuring.map((a) => a._id),
          artistId: isAdmin ? targetArtist?._id : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Réponse invalide du serveur." }));
        throw new Error(data.error ?? "Échec de la publication.");
      }

      pushToast("success", "Son envoyé avec succès.");
      onUploaded();
      onClose();
    } catch (err) {
      // Toujours visible dans la console pour le débogage, en plus du
      // message affiché dans l'interface.
      console.error("Échec de la publication du son :", err);
      const message = err instanceof Error ? err.message : "Échec de l'envoi.";
      setError(message);
      pushToast("error", message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center px-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl2 border border-border bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-display">Publier un son</h2>
          <button onClick={onClose} aria-label="Fermer" className="text-ink-muted hover:text-ink">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3.5 py-2.5 text-xs text-accent">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <FormField label="Titre" required value={title} onChange={(e) => setTitle(e.target.value)} />

          {isAdmin && <ArtistSinglePicker selected={targetArtist} onChange={setTargetArtist} />}

          <label className="block">
            <span className="text-sm text-ink-muted mb-1.5 block">Genre</span>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full rounded-xl border border-border bg-base px-4 py-2.5 text-sm outline-none focus:border-accent"
            >
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 cursor-pointer text-sm text-ink-muted hover:border-accent">
            <MusicIcon size={16} />
            {audioFile ? audioFile.name : "Choisir le fichier audio"}
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 cursor-pointer text-sm text-ink-muted hover:border-accent">
            <UploadCloud size={16} />
            {coverFile ? coverFile.name : "Choisir la pochette"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <FeaturingPicker selected={featuring} onChange={setFeaturing} />

          <FormField
            label="Date de sortie (laisser vide pour publier immédiatement)"
            type="datetime-local"
            value={releaseDate}
            onChange={(e) => setReleaseDate(e.target.value)}
          />

          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <input type="checkbox" checked={explicit} onChange={(e) => setExplicit(e.target.checked)} />
            Contenu explicite
          </label>

          {submitting && progress > 0 && (
            <div className="h-1.5 rounded-full bg-base overflow-hidden">
              <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-base hover:bg-accent-hover disabled:opacity-60"
          >
            {submitting ? "Envoi en cours..." : "Publier"}
          </button>
        </form>
      </div>
    </div>
  );
}
