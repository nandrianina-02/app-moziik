"use client";

import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/context/ToastProvider";

type SocialLink = { platform: string; url: string };

export function EditArtistProfileModal({
  bio,
  genres,
  socialLinks,
  onClose,
  onSaved,
}: {
  bio?: string;
  genres: string[];
  socialLinks: SocialLink[];
  onClose: () => void;
  onSaved: (data: { bio: string; genres: string[]; socialLinks: SocialLink[] }) => void;
}) {
  const pushToast = useToast();
  const [bioValue, setBioValue] = useState(bio ?? "");
  const [genresValue, setGenresValue] = useState(genres.join(", "));
  const [links, setLinks] = useState<SocialLink[]>(socialLinks.length > 0 ? socialLinks : [{ platform: "instagram", url: "" }]);
  const [saving, setSaving] = useState(false);

  function updateLink(index: number, field: keyof SocialLink, value: string) {
    setLinks((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  function addLink() {
    setLinks((prev) => [...prev, { platform: "instagram", url: "" }]);
  }

  function removeLink(index: number) {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    const cleanGenres = genresValue
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);
    const cleanLinks = links.filter((l) => l.url.trim());

    try {
      const res = await fetch("/api/artist/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: bioValue, genres: cleanGenres, socialLinks: cleanLinks }),
      });
      if (!res.ok) throw new Error();
      onSaved({ bio: bioValue, genres: cleanGenres, socialLinks: cleanLinks });
      pushToast("success", "Profil mis à jour.");
      onClose();
    } catch {
      pushToast("error", "Échec de la mise à jour du profil.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl2 bg-surface"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-medium">Modifier le profil</h2>
          <button onClick={onClose} aria-label="Fermer" className="text-ink-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-5 py-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">Biographie</span>
            <textarea
              value={bioValue}
              onChange={(e) => setBioValue(e.target.value)}
              rows={4}
              maxLength={2000}
              className="w-full resize-none rounded-xl border border-border bg-base px-3.5 py-2.5 text-sm outline-none focus:border-accent"
              placeholder="Parle de toi, de ta musique, de ton parcours..."
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">Genres (séparés par une virgule)</span>
            <input
              value={genresValue}
              onChange={(e) => setGenresValue(e.target.value)}
              placeholder="Pop, Afro, Soul"
              className="w-full rounded-xl border border-border bg-base px-3.5 py-2.5 text-sm outline-none focus:border-accent"
            />
          </label>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">Réseaux sociaux</span>
            <div className="space-y-2">
              {links.map((link, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={link.platform}
                    onChange={(e) => updateLink(i, "platform", e.target.value)}
                    className="rounded-xl border border-border bg-base px-2 py-2 text-xs outline-none focus:border-accent"
                  >
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                    <option value="tiktok">TikTok</option>
                    <option value="youtube">YouTube</option>
                    <option value="website">Site web</option>
                  </select>
                  <input
                    value={link.url}
                    onChange={(e) => updateLink(i, "url", e.target.value)}
                    placeholder="https://..."
                    className="min-w-0 flex-1 rounded-xl border border-border bg-base px-3 py-2 text-xs outline-none focus:border-accent"
                  />
                  <button onClick={() => removeLink(i)} aria-label="Retirer ce lien" className="shrink-0 text-ink-muted hover:text-accent">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addLink} className="mt-2 flex items-center gap-1 text-xs font-medium text-accent hover:underline">
              <Plus size={13} /> Ajouter un lien
            </button>
          </div>
        </div>

        <div className="border-t border-border px-5 py-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-full bg-accent py-2.5 text-sm font-medium text-base hover:bg-accent-hover disabled:opacity-60"
          >
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
