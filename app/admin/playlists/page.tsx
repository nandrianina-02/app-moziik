"use client";

import { useEffect, useState } from "react";
import { Search, Trash2, Globe, Lock, ListMusic } from "lucide-react";
import { EqualizerLoader } from "@/components/ui/EqualizerLoader";
import { IconActionButton, IconActionLink } from "@/components/admin/IconActionButton";
import { AdminItemGrid } from "@/components/admin/AdminItemGrid";
import { useToast } from "@/context/ToastProvider";

type AdminPlaylist = {
  _id: string;
  title: string;
  isPublic: boolean;
  songs: string[];
  owner: { name: string; email: string };
};

export default function AdminPlaylistsPage() {
  const pushToast = useToast();
  const [playlists, setPlaylists] = useState<AdminPlaylist[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/api/admin/playlists${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPlaylists(data.playlists);
    } catch {
      pushToast("error", "Impossible de charger les playlists.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(load, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function deletePlaylist(id: string) {
    const res = await fetch(`/api/playlists/${id}`, { method: "DELETE" });
    if (!res.ok) {
      pushToast("error", "La suppression a échoué.");
      return;
    }
    pushToast("success", "Playlist supprimée.");
    setPlaylists((prev) => prev.filter((p) => p._id !== id));
  }

  return (
    <div>
      <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 mb-6 max-w-sm">
        <Search size={16} className="text-ink-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une playlist..."
          className="bg-transparent text-sm outline-none flex-1"
        />
      </label>

      {loading && (
        <div className="py-10 grid place-items-center">
          <EqualizerLoader />
        </div>
      )}

      <div>
        {!loading && playlists.length === 0 && (
          <p className="text-sm text-ink-muted">Aucune playlist ne correspond.</p>
        )}

        <AdminItemGrid cols={3}>
          {playlists.map((playlist) => (
            <div
              key={playlist._id}
              className="flex flex-wrap items-center gap-3 rounded-xl2 border border-border bg-surface px-4 py-3.5"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-base">
                <ListMusic size={18} className="text-ink-muted" />
              </div>
              <div className="flex-1 min-w-[140px]">
                <p className="flex items-center gap-1.5 text-sm font-medium truncate">
                  {playlist.title}
                  {playlist.isPublic ? (
                    <Globe size={11} className="text-verified shrink-0" />
                  ) : (
                    <Lock size={11} className="text-ink-muted shrink-0" />
                  )}
                </p>
                <p className="text-xs text-ink-muted truncate">
                  {playlist.owner?.name ?? "Utilisateur supprimé"} · {playlist.songs.length} son(s)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <IconActionLink icon={ListMusic} label="Voir" href={`/playlist/${playlist._id}`} />
                <IconActionButton icon={Trash2} label="Supprimer" onClick={() => deletePlaylist(playlist._id)} />
              </div>
            </div>
          ))}
        </AdminItemGrid>
      </div>
    </div>
  );
}
