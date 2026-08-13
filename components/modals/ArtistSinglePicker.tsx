"use client";

import { useState } from "react";
import { Search, BadgeCheck, X } from "lucide-react";

type ArtistOption = { _id: string; stageName: string; verified?: boolean };

export function ArtistSinglePicker({
  selected,
  onChange,
}: {
  selected: ArtistOption | null;
  onChange: (artist: ArtistOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ArtistOption[]>([]);
  const [searching, setSearching] = useState(false);

  async function handleSearch(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/artists?search=${encodeURIComponent(value)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResults(data.artists);
    } finally {
      setSearching(false);
    }
  }

  if (selected) {
    return (
      <div>
        <span className="text-sm text-ink-muted mb-1.5 block">Artiste</span>
        <div className="flex items-center justify-between rounded-xl border border-border bg-base px-3.5 py-2.5">
          <span className="flex items-center gap-1.5 text-sm">
            {selected.stageName}
            {selected.verified && <BadgeCheck size={13} className="text-verified" />}
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Changer d'artiste"
            className="text-ink-muted hover:text-accent"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <span className="text-sm text-ink-muted mb-1.5 block">Artiste (obligatoire)</span>
      <div className="relative">
        <label className="flex items-center gap-2 rounded-xl border border-border bg-base px-3.5 py-2.5">
          <Search size={14} className="text-ink-muted" />
          <input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Rechercher l'artiste pour qui publier..."
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </label>

        {(results.length > 0 || searching) && (
          <div className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-surface shadow-lg max-h-40 overflow-y-auto">
            {searching && <p className="px-3.5 py-2 text-xs text-ink-muted">Recherche...</p>}
            {results.map((artist) => (
              <button
                key={artist._id}
                type="button"
                onClick={() => {
                  onChange(artist);
                  setQuery("");
                  setResults([]);
                }}
                className="w-full flex items-center gap-1.5 px-3.5 py-2 text-left text-sm hover:bg-base"
              >
                {artist.stageName}
                {artist.verified && <BadgeCheck size={11} className="text-verified" />}
              </button>
            ))}
            {!searching && results.length === 0 && query.trim().length >= 2 && (
              <p className="px-3.5 py-2 text-xs text-ink-muted">Aucun artiste trouvé.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
