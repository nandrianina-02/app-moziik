"use client";

import { useEffect, useRef, useState } from "react";
import { X, Search, Trash2, UploadCloud } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { FormField } from "@/components/ui/FormField";
import { uploadToCloudinaryClient } from "@/lib/cloudinaryClient";
import { useToast } from "@/context/ToastProvider";
import { useEscapeClose } from "@/hooks/useEscapeClose";

type ContentType = "song" | "album" | "artist" | "playlist" | "event";

type PinnedItem = {
  _id: string;
  contentType: ContentType | "custom";
  title: string;
  coverUrl?: string;
  priority: number;
};

type SearchResult = { _id: string; title: string; coverUrl?: string };

const contentTypeLabel: Record<ContentType, string> = {
  song: "Titre",
  album: "Album",
  artist: "Artiste",
  playlist: "Playlist",
  event: "Évènement",
};

export function PinnedContentManager({
  sectionSlug,
  sectionTitle,
  helpText,
  onClose,
}: {
  sectionSlug: string;
  sectionTitle: string;
  helpText?: string;
  onClose: () => void;
}) {
  useEscapeClose(onClose);
  const pushToast = useToast();
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<"existing" | "custom">("existing");

  // Mode "contenu existant"
  const [searchType, setSearchType] = useState<ContentType>("song");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Mode "élément personnalisé"
  const [customTitle, setCustomTitle] = useState("");
  const [customSubtitle, setCustomSubtitle] = useState("");
  const [customHref, setCustomHref] = useState("");
  const [customCoverUrl, setCustomCoverUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const [priority, setPriority] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadPinned() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/homepage/pinned");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPinnedItems(data.pinned.filter((p: PinnedItem & { section: string }) => p.section === sectionSlug));
    } catch {
      pushToast("error", "Impossible de charger le contenu actuel.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPinned();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionSlug]);

  useEffect(() => {
    setSelected(null);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/homepage/content-search?type=${searchType}&q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setResults(data.results);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchType, query]);

  async function handleCoverUpload(file: File) {
    setUploading(true);
    try {
      const { url } = await uploadToCloudinaryClient(file, "site-assets");
      setCustomCoverUrl(url);
    } catch {
      pushToast("error", "Échec de l'envoi de l'image.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    const base = { section: sectionSlug, priority, startDate: startDate || undefined, endDate: endDate || undefined };
    const body =
      mode === "existing"
        ? selected && { contentType: searchType, contentId: selected._id, ...base }
        : customTitle.trim() && customHref.trim()
        ? {
            contentType: "custom" as const,
            customTitle: customTitle.trim(),
            customSubtitle: customSubtitle.trim() || undefined,
            customCoverUrl: customCoverUrl || undefined,
            customHref: customHref.trim(),
            ...base,
          }
        : null;

    if (!body) {
      pushToast("error", mode === "existing" ? "Choisis un contenu dans la liste." : "Titre et lien sont obligatoires.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/homepage/pinned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      pushToast("success", "Ajouté à la section.");
      setSelected(null);
      setQuery("");
      setCustomTitle("");
      setCustomSubtitle("");
      setCustomHref("");
      setCustomCoverUrl("");
      loadPinned();
    } catch (err) {
      pushToast("error", err instanceof Error && err.message ? err.message : "Échec de l'enregistrement.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id: string) {
    try {
      const res = await fetch(`/api/admin/homepage/pinned/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setPinnedItems((prev) => prev.filter((p) => p._id !== id));
    } catch {
      pushToast("error", "Échec de la suppression.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-xl2 border border-border bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-display">Contenu — {sectionTitle}</h2>
            {helpText && <p className="text-xs text-ink-muted">{helpText}</p>}
          </div>
          <button onClick={onClose} aria-label="Fermer" className="text-ink-muted hover:text-ink">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-ink-muted">Chargement...</p>
        ) : (
          <>
            {pinnedItems.length > 0 && (
              <div className="mb-5 space-y-2">
                <p className="text-xs font-medium text-ink-muted">Éléments actuels</p>
                {pinnedItems.map((item) => (
                  <div key={item._id} className="flex items-center gap-3 rounded-xl border border-border p-2.5">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-base">
                      <SafeImage src={item.coverUrl} alt={item.title} width={40} height={40} className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{item.title}</p>
                      <p className="text-xs text-ink-muted">
                        {item.contentType === "custom" ? "Personnalisé" : contentTypeLabel[item.contentType]} · priorité {item.priority}
                      </p>
                    </div>
                    <button onClick={() => handleRemove(item._id)} className="text-ink-muted hover:text-accent" aria-label="Retirer">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {pinnedItems.length === 0 && (
              <p className="mb-4 text-sm text-ink-muted">
                Cette section est vide pour l&apos;instant : ajoute un premier élément ci-dessous pour qu&apos;elle s&apos;affiche sur l&apos;accueil.
              </p>
            )}

            <div className="mb-4 flex gap-2 border-b border-border">
              <button
                onClick={() => setMode("existing")}
                className={`px-3 py-2 text-sm ${mode === "existing" ? "border-b-2 border-accent text-ink" : "text-ink-muted"}`}
              >
                Contenu existant
              </button>
              <button
                onClick={() => setMode("custom")}
                className={`px-3 py-2 text-sm ${mode === "custom" ? "border-b-2 border-accent text-ink" : "text-ink-muted"}`}
              >
                Élément personnalisé
              </button>
            </div>

            {mode === "existing" ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <select
                    value={searchType}
                    onChange={(e) => setSearchType(e.target.value as ContentType)}
                    className="rounded-lg border border-border bg-base px-2 py-1.5 text-sm text-ink"
                  >
                    {Object.entries(contentTypeLabel).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Rechercher par nom..."
                      className="w-full rounded-lg border border-border bg-base py-1.5 pl-8 pr-2 text-sm text-ink"
                    />
                  </div>
                </div>

                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {searching && <p className="py-2 text-center text-xs text-ink-muted">Recherche...</p>}
                  {!searching && results.length === 0 && (
                    <p className="py-2 text-center text-xs text-ink-muted">Aucun résultat.</p>
                  )}
                  {results.map((r) => (
                    <button
                      key={r._id}
                      onClick={() => setSelected(r)}
                      className={`flex w-full items-center gap-2.5 rounded-lg p-2 text-left text-sm hover:bg-base ${
                        selected?._id === r._id ? "bg-accent/10 text-accent" : ""
                      }`}
                    >
                      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-base">
                        <SafeImage src={r.coverUrl} alt={r.title} width={32} height={32} className="h-full w-full object-cover" />
                      </div>
                      <span className="truncate">{r.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="group relative block h-28 w-full cursor-pointer overflow-hidden rounded-xl bg-base">
                  <SafeImage src={customCoverUrl} alt="" width={500} height={140} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 grid place-items-center gap-1 bg-black/40 text-white">
                    <UploadCloud size={18} />
                    <span className="text-xs">{uploading ? "Envoi..." : "Choisir une image"}</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleCoverUpload(file);
                    }}
                  />
                </label>
                <FormField label="Titre" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} />
                <FormField label="Sous-titre" value={customSubtitle} onChange={(e) => setCustomSubtitle(e.target.value)} />
                <FormField
                  label="Lien (ex: /evenements ou https://...)"
                  value={customHref}
                  onChange={(e) => setCustomHref(e.target.value)}
                />
              </div>
            )}

            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4">
              <FormField label="Priorité" type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
              <FormField label="Début" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <FormField label="Fin" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="mt-4 w-full rounded-xl bg-accent px-4 py-2 text-sm font-medium text-base hover:bg-accent-hover disabled:opacity-60"
            >
              Ajouter à la section
            </button>
          </>
        )}
      </div>
    </div>
  );
}
