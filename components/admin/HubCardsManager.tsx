"use client";

import { useEffect, useState } from "react";
import { X, Plus, Trash2, ArrowUp, ArrowDown, UploadCloud } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { Toggle } from "@/components/admin/Toggle";
import { uploadToCloudinaryClient } from "@/lib/cloudinaryClient";
import { useToast } from "@/context/ToastProvider";
import { useEscapeClose } from "@/hooks/useEscapeClose";

type HubCard = {
  _id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  coverUrl?: string;
  linkHref: string;
  enabled: boolean;
  position: number;
};

export function HubCardsManager({ onClose }: { onClose: () => void }) {
  useEscapeClose(onClose);
  const pushToast = useToast();
  const [cards, setCards] = useState<HubCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/homepage/hub-cards");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCards(data.cards);
    } catch {
      pushToast("error", "Impossible de charger les cartes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateCard(id: string, updates: Partial<HubCard>) {
    setCards((prev) => prev.map((c) => (c._id === id ? { ...c, ...updates } : c)));
    try {
      const res = await fetch(`/api/admin/homepage/hub-cards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error();
    } catch {
      pushToast("error", "Échec de l'enregistrement.");
      load();
    }
  }

  async function deleteCard(id: string) {
    try {
      const res = await fetch(`/api/admin/homepage/hub-cards/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setCards((prev) => prev.filter((c) => c._id !== id));
      pushToast("success", "Carte supprimée.");
    } catch {
      pushToast("error", "Échec de la suppression.");
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= cards.length) return;
    const reordered = [...cards];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setCards(reordered);
    try {
      await fetch("/api/admin/homepage/hub-cards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: reordered.map((c, i) => ({ id: c._id, position: i })) }),
      });
    } catch {
      pushToast("error", "Échec de la réorganisation.");
      load();
    }
  }

  async function handleCoverChange(id: string, file: File) {
    setUploadingId(id);
    try {
      const { url } = await uploadToCloudinaryClient(file, "site-assets");
      await updateCard(id, { coverUrl: url });
    } catch {
      pushToast("error", "Échec de l'envoi de l'image.");
    } finally {
      setUploadingId(null);
    }
  }

  async function createCard(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) {
      pushToast("error", "Le titre est obligatoire.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/homepage/hub-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), linkHref: "/", enabled: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setNewTitle("");
      pushToast("success", "Carte créée.");
      load();
    } catch (err) {
      pushToast("error", err instanceof Error && err.message ? err.message : "Échec de la création.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl2 border border-border bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-display">Cartes de la section &quot;Pour vous&quot;</h2>
            <p className="text-xs text-ink-muted">
              Chaque carte sans pochette personnalisée affiche automatiquement la pochette du contenu réel correspondant
              (dernière sortie, titre le plus écouté...).
            </p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="text-ink-muted hover:text-ink">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-ink-muted">Chargement...</p>
        ) : (
          <div className="space-y-3">
            {cards.map((card, index) => (
              <div key={card._id} className="rounded-xl border border-border p-3">
                <div className="flex items-start gap-3">
                  <label className="group relative h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-lg bg-base">
                    <SafeImage src={card.coverUrl} alt={card.title} width={64} height={64} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 grid place-items-center bg-black/0 text-transparent transition-colors group-hover:bg-black/50 group-hover:text-white">
                      <UploadCloud size={16} />
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleCoverChange(card._id, file);
                      }}
                    />
                    {uploadingId === card._id && (
                      <div className="absolute inset-0 grid place-items-center bg-black/60 text-[10px] text-white">...</div>
                    )}
                  </label>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <input
                        value={card.title}
                        onChange={(e) => setCards((prev) => prev.map((c) => (c._id === card._id ? { ...c, title: e.target.value } : c)))}
                        onBlur={(e) => updateCard(card._id, { title: e.target.value })}
                        placeholder="Titre (ex: Daily Mix)"
                        className="min-w-[140px] flex-1 rounded-lg border border-border bg-base px-2 py-1.5 text-sm text-ink"
                      />
                      <input
                        value={card.badge ?? ""}
                        onChange={(e) => setCards((prev) => prev.map((c) => (c._id === card._id ? { ...c, badge: e.target.value } : c)))}
                        onBlur={(e) => updateCard(card._id, { badge: e.target.value })}
                        placeholder="Badge (ex: 01)"
                        className="w-24 rounded-lg border border-border bg-base px-2 py-1.5 text-sm text-ink"
                      />
                    </div>
                    <input
                      value={card.subtitle ?? ""}
                      onChange={(e) => setCards((prev) => prev.map((c) => (c._id === card._id ? { ...c, subtitle: e.target.value } : c)))}
                      onBlur={(e) => updateCard(card._id, { subtitle: e.target.value })}
                      placeholder="Sous-titre"
                      className="w-full rounded-lg border border-border bg-base px-2 py-1.5 text-sm text-ink"
                    />
                    <input
                      value={card.linkHref}
                      onChange={(e) => setCards((prev) => prev.map((c) => (c._id === card._id ? { ...c, linkHref: e.target.value } : c)))}
                      onBlur={(e) => updateCard(card._id, { linkHref: e.target.value })}
                      placeholder="Lien (ex: /recherche?q=chill ou #new_releases)"
                      className="w-full rounded-lg border border-border bg-base px-2 py-1.5 text-sm text-ink"
                    />
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Toggle checked={card.enabled} onChange={() => updateCard(card._id, { enabled: !card.enabled })} label={`Activer ${card.title}`} />
                    <div className="flex items-center gap-1">
                      <button onClick={() => move(index, -1)} disabled={index === 0} className="text-ink-muted hover:text-ink disabled:opacity-30" aria-label="Monter">
                        <ArrowUp size={14} />
                      </button>
                      <button
                        onClick={() => move(index, 1)}
                        disabled={index === cards.length - 1}
                        className="text-ink-muted hover:text-ink disabled:opacity-30"
                        aria-label="Descendre"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button onClick={() => deleteCard(card._id)} className="text-ink-muted hover:text-accent" aria-label="Supprimer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {cards.length === 0 && <p className="text-sm text-ink-muted">Aucune carte pour l&apos;instant.</p>}
          </div>
        )}

        <form onSubmit={createCard} className="mt-4 flex items-center gap-2 border-t border-border pt-4">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Titre de la nouvelle carte"
            className="flex-1 rounded-lg border border-border bg-base px-2 py-1.5 text-sm text-ink"
          />
          <button
            type="submit"
            disabled={creating}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-xs font-medium text-base hover:bg-accent-hover disabled:opacity-60"
          >
            <Plus size={14} /> Ajouter
          </button>
        </form>
      </div>
    </div>
  );
}
