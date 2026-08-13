"use client";

import { useState } from "react";
import { X, Search, BadgeCheck } from "lucide-react";

type ArtistOption = { _id: string; stageName: string; verified?: boolean };

export function FeaturingPicker({
  selected,
  onChange,
}: {
  selected: ArtistOption[];
  onChange: (artists: ArtistOption[]) => void;
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

  function addArtist(artist: ArtistOption) {
    if (!selected.some((a) => a._id === artist._id)) {
      onChange([...selected, artist]);
    }
    setQuery("");
    setResults([]);
  }

  function removeArtist(id: string) {
    onChange(selected.filter((a) => a._id !== id));
  }

  return (
    <div>
      <span className="text-sm text-ink-muted mb-1.5 block">Featuring (optionnel)</span>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((artist) => (
            <span
              key={artist._id}
              className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs"
            >
              {artist.stageName}
              {artist.verified && <BadgeCheck size={11} className="text-verified" />}
              <button onClick={() => removeArtist(artist._id)} aria-label="Retirer" className="text-ink-muted hover:text-accent">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <label className="flex items-center gap-2 rounded-xl border border-border bg-base px-3.5 py-2.5">
          <Search size={14} className="text-ink-muted" />
          <input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Rechercher un artiste..."
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
                onClick={() => addArtist(artist)}
                className="w-full flex items-center gap-1.5 px-3.5 py-2 text-left text-sm hover:bg-base"
              >
                {artist.stageName}
                {artist.verified && <BadgeCheck size={11} className="text-verified" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
