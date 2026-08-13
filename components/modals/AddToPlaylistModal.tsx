"use client";

import { useEffect, useState } from "react";
import { X, Plus, ListMusic } from "lucide-react";
import { useToast } from "@/context/ToastProvider";

type Playlist = { _id: string; title: string; coverUrl?: string };

export function AddToPlaylistModal({
  songId,
  onClose,
}: {
  songId: string;
  onClose: () => void;
}) {
  const pushToast = useToast();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch("/api/playlists?owner=me");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPlaylists(data.playlists);
    } catch {
      pushToast("error", "Impossible de charger tes playlists.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addTo(playlistId: string) {
    const res = await fetch(`/api/playlists/${playlistId}/songs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songId }),
    });
    if (!res.ok) {
      pushToast("error", "Échec de l'ajout à la playlist.");
      return;
    }
    pushToast("success", "Ajouté à la playlist.");
    onClose();
  }

  async function createAndAdd() {
    if (!newTitle.trim()) return;
    const res = await fetch("/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim() }),
    });
    if (!res.ok) {
      pushToast("error", "Échec de la création de la playlist.");
      return;
    }
    const data = await res.json();
    await addTo(data.playlist._id);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl2 border border-border bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display">Ajouter à une playlist</h2>
          <button onClick={onClose} aria-label="Fermer" className="text-ink-muted hover:text-ink">
            <X size={20} />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Nouvelle playlist..."
            className="flex-1 rounded-xl border border-border bg-base px-3.5 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            onClick={createAndAdd}
            aria-label="Créer et ajouter"
            className="grid h-9 w-9 place-items-center rounded-full bg-accent text-base hover:bg-accent-hover shrink-0"
          >
            <Plus size={16} />
          </button>
        </div>

        {loading && <p className="text-sm text-ink-muted">Chargement...</p>}
        {!loading && playlists.length === 0 && (
          <p className="text-sm text-ink-muted">Tu n&apos;as pas encore de playlist.</p>
        )}

        <ul className="space-y-1 max-h-64 overflow-y-auto">
          {playlists.map((playlist) => (
            <li key={playlist._id}>
              <button
                onClick={() => addTo(playlist._id)}
                className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-base"
              >
                <ListMusic size={16} className="text-ink-muted" />
                {playlist.title}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
