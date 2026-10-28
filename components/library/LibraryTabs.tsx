"use client";

import type { LucideIcon } from "lucide-react";

export type LibraryTabKey =
  | "tout"
  | "playlists"
  | "titres"
  | "albums"
  | "artistes"
  | "podcasts"
  | "telechargements";

export function LibraryTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: LibraryTabKey; label: string; icon: LucideIcon }[];
  active: LibraryTabKey;
  onChange: (key: LibraryTabKey) => void;
}) {
  // Des puces, comme la bibliothèque de Spotify et les filtres de l'accueil :
  // la catégorie ouverte est pleine, les autres restent discrètes.
  return (
    <div className="-mx-6 mb-6 overflow-x-auto px-6 pb-1 md:-mx-10 md:px-10" role="tablist" aria-label="Catégories de la bibliothèque">
      <div className="flex w-max items-center gap-2">
        {tabs.map(({ key, label, icon: Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(key)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ${
                isActive ? "bg-ink text-base" : "bg-ink/[0.08] text-ink hover:bg-ink/[0.14]"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
