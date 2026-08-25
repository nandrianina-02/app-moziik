"use client";

const KEY = "moziik-recent-searches";
const MAX_ITEMS = 12;

/**
 * Historique de recherche, local au navigateur.
 *
 * `term` est apparu avec la recherche globale : on mémorise désormais aussi
 * les saisies elles-mêmes, pas seulement les contenus ouverts. Relancer
 * « nandrianina » d'un clic est le geste le plus fréquent, et il n'était pas
 * possible tant que seuls les titres et artistes visités étaient retenus.
 *
 * Les entrées écrites par les versions précédentes restent lisibles : elles
 * ont toujours un `type` parmi ceux d'alors, et les nouveaux champs sont
 * facultatifs.
 */
export type TypeRecherche = "song" | "artist" | "album" | "playlist" | "term";

export type RecentSearchItem = {
  /** Identifiant du contenu, ou la saisie normalisée pour un `term`. */
  _id: string;
  type: TypeRecherche;
  title: string;
  coverUrl?: string;
  /** Nom de l'artiste (titre), « Artiste », nombre de titres (playlist)… */
  subtitle: string;
  verified?: boolean;
  playsCount?: number;
  href: string;
};

function read(): RecentSearchItem[] {
  if (typeof window === "undefined") return [];
  try {
    const brut = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(brut) ? brut : [];
  } catch {
    return [];
  }
}

function write(items: RecentSearchItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Stockage plein ou refusé : l'historique est un confort, pas une
    // fonctionnalité dont dépend la recherche.
  }
  window.dispatchEvent(new Event("moziik-recent-searches-change"));
}

export function getRecentSearches(): RecentSearchItem[] {
  return read();
}

export function addRecentSearch(item: RecentSearchItem) {
  const current = read().filter((i) => i._id !== item._id);
  write([item, ...current].slice(0, MAX_ITEMS));
}

/** Mémorise une saisie validée (touche Entrée), et non un contenu ouvert. */
export function addRecentTerm(terme: string) {
  const propre = terme.trim();
  if (propre.length < 2) return;
  addRecentSearch({
    _id: `terme:${propre.toLowerCase()}`,
    type: "term",
    title: propre,
    subtitle: "Recherche",
    href: `/recherche?q=${encodeURIComponent(propre)}`,
  });
}

export function removeRecentSearch(id: string) {
  write(read().filter((i) => i._id !== id));
}

export function clearRecentSearches() {
  write([]);
}
