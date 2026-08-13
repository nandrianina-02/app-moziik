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
  return (
    <div className="-mx-6 mb-6 overflow-x-auto px-6 md:-mx-10 md:px-10">
      <div className="flex w-max items-center gap-1 border-b border-border">
        {tabs.map(({ key, label, icon: Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className={`relative flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2.5 text-sm transition-colors ${
                isActive ? "text-ink font-medium" : "text-ink-muted hover:text-ink"
              }`}
            >
              <Icon size={15} />
              {label}
              <span
                className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full transition-colors ${
                  isActive ? "bg-accent" : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
