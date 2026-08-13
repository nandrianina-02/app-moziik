"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

const MAX_TAGS = 15;

/**
 * Champ à jetons pour les mots-clés de découverte d'un morceau.
 * Entrée / virgule ajoute le tag en cours ; Retour arrière sur un champ
 * vide retire le dernier tag — comportement standard des inputs à chips.
 */
export function TagInput({
  value,
  onChange,
  placeholder = "Ajouter un tag...",
  preserveCase = false,
  maxTags = MAX_TAGS,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  /** Les genres (ex. "Hip-hop", "R&B") doivent garder leur casse ; les tags de découverte restent normalisés en minuscules par défaut. */
  preserveCase?: boolean;
  maxTags?: number;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const cleaned = draft.trim().replace(/\s+/g, " ");
    const tag = preserveCase ? cleaned : cleaned.toLowerCase();
    if (tag && !value.includes(tag) && value.length < maxTags) {
      onChange([...value, tag]);
    }
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && draft.length === 0 && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-base px-3 py-2 transition-colors focus-within:border-accent">
      {value.map((tag) => (
        <span
          key={tag}
          className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-ink-muted"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            aria-label={`Retirer le tag ${tag}`}
            className="text-ink-muted transition-colors hover:text-accent"
          >
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        placeholder={value.length === 0 ? placeholder : ""}
        className="min-w-[120px] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-ink-muted"
      />
    </div>
  );
}
