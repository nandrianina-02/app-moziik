"use client";

import { useState } from "react";
import { Plus, X, ListMusic } from "lucide-react";
import { useToast } from "@/context/ToastProvider";

export function CreatePlaylistTile({ onCreated }: { onCreated: (playlist: { _id: string; title: string; coverUrl?: string; songs: string[] }) => void }) {
  const pushToast = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      onCreated(data.playlist);
      // Prévient la section « Mes playlists » du menu latéral
      // (components/layout/SidebarPlaylists.tsx) pour qu'elle se mette à
      // jour sans rechargement.
      window.dispatchEvent(new Event("moziik-playlists-change"));
      pushToast("success", "Playlist créée.");
      setTitle("");
      setOpen(false);
    } catch {
      pushToast("error", "Échec de la création de la playlist.");
    } finally {
      setSaving(false);
    }
  }

  if (open) {
    return (
      <div className="rounded-xl2 border border-accent/40 bg-surface p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
            <ListMusic size={13} /> Nouvelle playlist
          </span>
          <button onClick={() => setOpen(false)} aria-label="Annuler" className="text-ink-muted hover:text-ink">
            <X size={14} />
          </button>
        </div>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="Nom de la playlist"
          className="mb-2 w-full rounded-lg border border-border bg-base px-2.5 py-1.5 text-xs outline-none focus:border-accent"
        />
        <button
          onClick={handleCreate}
          disabled={saving || !title.trim()}
          className="w-full rounded-lg bg-accent py-1.5 text-xs font-medium text-base hover:bg-accent-hover disabled:opacity-60"
        >
          {saving ? "Création..." : "Créer"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setOpen(true)}
      className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl2 border border-dashed border-border text-ink-muted transition-colors hover:border-accent hover:text-accent"
    >
      <Plus size={22} />
      <span className="text-xs font-medium">Créer</span>
    </button>
  );
}
