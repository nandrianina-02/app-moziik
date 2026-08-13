"use client";

import { useEffect, useState } from "react";
import { Check, X, Pencil, Trash2, BadgeCheck } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { EqualizerLoader } from "@/components/ui/EqualizerLoader";
import { IconActionButton, IconActionLink } from "@/components/admin/IconActionButton";
import { AdminItemGrid } from "@/components/admin/AdminItemGrid";
import { useToast } from "@/context/ToastProvider";

type AdminSong = {
  _id: string;
  title: string;
  coverUrl: string;
  genre: string;
  status: "draft" | "scheduled" | "published" | "rejected";
  releaseDate: string;
  // Peut être null si l'artiste (ou son compte utilisateur) a été supprimé
  // depuis : la suppression d'un compte ne réassigne pas ses sons.
  artist: { stageName: string; verified?: boolean } | null;
};

const statusFilters: { value: string; label: string }[] = [
  { value: "", label: "Tous" },
  { value: "draft", label: "En attente" },
  { value: "published", label: "Publiés" },
  { value: "scheduled", label: "Planifiés" },
  { value: "rejected", label: "Rejetés" },
];

const statusLabel: Record<AdminSong["status"], string> = {
  draft: "En attente",
  scheduled: "Planifié",
  published: "Publié",
  rejected: "Rejeté",
};

const statusColor: Record<AdminSong["status"], string> = {
  draft: "text-ink-muted",
  scheduled: "text-accent",
  published: "text-verified",
  rejected: "text-accent",
};

export default function AdminSongsPage() {
  const pushToast = useToast();
  const [songs, setSongs] = useState<AdminSong[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/admin/songs${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSongs(data.songs);
    } catch {
      pushToast("error", "Impossible de charger les sons.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function moderate(id: string, decision: "approve" | "reject") {
    const res = await fetch(`/api/admin/songs/${id}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    if (!res.ok) {
      pushToast("error", "L'action a échoué.");
      return;
    }
    pushToast("success", decision === "approve" ? "Son approuvé." : "Son rejeté.");
    load();
  }

  async function deleteSong(id: string) {
    const res = await fetch(`/api/songs/${id}`, { method: "DELETE" });
    if (!res.ok) {
      pushToast("error", "La suppression a échoué.");
      return;
    }
    pushToast("success", "Son supprimé.");
    setSongs((prev) => prev.filter((s) => s._id !== id));
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

      {loading && (
        <div className="py-10 grid place-items-center">
          <EqualizerLoader />
        </div>
      )}

      <div>
        {!loading && songs.length === 0 && (
          <p className="text-sm text-ink-muted">Aucun son pour ce filtre.</p>
        )}

        <AdminItemGrid cols={2}>
          {songs.map((song) => (
            <div
              key={song._id}
              className="flex flex-wrap items-center gap-3 rounded-xl2 border border-border bg-surface px-4 py-3.5"
            >
              {song.coverUrl ? (
                <SafeImage src={song.coverUrl} alt={song.title} width={44} height={44} className="rounded-lg object-cover shrink-0" />
              ) : (
                <div className="h-11 w-11 rounded-lg bg-base shrink-0" />
              )}
              <div className="flex-1 min-w-[140px]">
                <p className="text-sm font-medium truncate">{song.title}</p>
                <p className="flex items-center gap-1 text-xs text-ink-muted truncate">
                  {song.artist ? (
                    <>
                      {song.artist.stageName}
                      {song.artist.verified && <BadgeCheck size={11} className="text-verified shrink-0" />}
                    </>
                  ) : (
                    <span className="italic text-accent">Artiste supprimé</span>
                  )}
                  {" · "}{song.genre}
                </p>
                <p className={`text-[11px] mt-0.5 ${statusColor[song.status]}`}>{statusLabel[song.status]}</p>
              </div>

              <div className="flex items-center gap-2">
                {song.status === "draft" && (
                  <>
                    <IconActionButton icon={Check} label="Approuver" tone="success" onClick={() => moderate(song._id, "approve")} />
                    <IconActionButton icon={X} label="Rejeter" tone="danger" onClick={() => moderate(song._id, "reject")} />
                  </>
                )}
                <IconActionLink icon={Pencil} label="Modifier" href={`/son/${song._id}/modifier`} />
                <IconActionButton icon={Trash2} label="Supprimer" onClick={() => deleteSong(song._id)} />
              </div>
            </div>
          ))}
        </AdminItemGrid>
      </div>
    </div>
  );
}
