"use client";

import { Plus, Trash2 } from "lucide-react";

export type SocialLink = { platform: string; url: string };

/**
 * Les liens sociaux d'un artiste, en lignes ajoutables.
 *
 * Partagé par l'artiste (qui édite son propre profil) et par
 * l'administration (qui édite celui d'un autre) : c'est le même champ,
 * enregistré au même endroit, il n'avait pas à exister en deux versions.
 */
export function SocialLinksEditor({
  links,
  onChange,
  max = 8,
}: {
  links: SocialLink[];
  onChange: (links: SocialLink[]) => void;
  max?: number;
}) {
  function modifier(index: number, champ: keyof SocialLink, valeur: string) {
    onChange(links.map((l, i) => (i === index ? { ...l, [champ]: valeur } : l)));
  }

  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-ink-muted">Réseaux sociaux</span>

      <div className="space-y-2">
        {links.map((link, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              value={link.platform}
              onChange={(e) => modifier(i, "platform", e.target.value)}
              aria-label={`Réseau du lien ${i + 1}`}
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
              onChange={(e) => modifier(i, "url", e.target.value)}
              placeholder="https://..."
              aria-label={`Adresse du lien ${i + 1}`}
              className="min-w-0 flex-1 rounded-xl border border-border bg-base px-3 py-2 text-xs outline-none focus:border-accent"
            />

            <button
              type="button"
              onClick={() => onChange(links.filter((_, index) => index !== i))}
              aria-label="Retirer ce lien"
              className="shrink-0 text-ink-muted transition-colors hover:text-danger"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      {links.length < max && (
        <button
          type="button"
          onClick={() => onChange([...links, { platform: "instagram", url: "" }])}
          className="mt-2 flex items-center gap-1 text-xs font-medium text-accent hover:underline"
        >
          <Plus size={13} /> Ajouter un lien
        </button>
      )}
    </div>
  );
}
