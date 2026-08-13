"use client";

const KEY = "moziik-recent-searches";
const MAX_ITEMS = 12;

export type RecentSearchItem = {
  _id: string;
  type: "song" | "artist";
  title: string;
  coverUrl: string;
  subtitle: string; // nom de l'artiste (son) ou "Artiste" (artiste)
  verified?: boolean;
  playsCount?: number;
  href: string;
};

function read(): RecentSearchItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function write(items: RecentSearchItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("moziik-recent-searches-change"));
}

export function getRecentSearches(): RecentSearchItem[] {
  return read();
}

export function addRecentSearch(item: RecentSearchItem) {
  const current = read().filter((i) => i._id !== item._id);
  write([item, ...current].slice(0, MAX_ITEMS));
}

export function removeRecentSearch(id: string) {
  write(read().filter((i) => i._id !== id));
}

export function clearRecentSearches() {
  write([]);
}
