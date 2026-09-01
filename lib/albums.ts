/**
 * Les formes que prend une publication d'artiste.
 *
 * Un podcast est un album comme un autre : une pochette, une date, une
 * suite de pistes. Ce qui change est le vocabulaire — on y écoute des
 * épisodes, pas des titres — et l'endroit où on le range. Lui donner son
 * propre modèle aurait dupliqué la publication, la bibliothèque, le
 * lecteur et le hors-ligne pour ne rien gagner.
 *
 * Volontairement sans mongoose : la liste est lue par les formulaires et
 * les cartes, côté navigateur (même raisonnement que `lib/evenements.ts`).
 */

export type AlbumType = "album" | "ep" | "single" | "podcast";

export const ALBUM_TYPES: AlbumType[] = ["album", "ep", "single", "podcast"];

export const LIBELLES_TYPE_ALBUM: Record<AlbumType, string> = {
  album: "Album",
  ep: "EP",
  single: "Single",
  podcast: "Podcast",
};

export function libelleTypeAlbum(type?: string | null): string {
  if (type && type in LIBELLES_TYPE_ALBUM) return LIBELLES_TYPE_ALBUM[type as AlbumType];
  return LIBELLES_TYPE_ALBUM.album;
}

export function estPodcast(type?: string | null): boolean {
  return type === "podcast";
}

/**
 * Comment nommer les pistes d'une publication.
 *
 * « 12 titres » sur un podcast sonne faux, et « 12 épisodes » sur un album
 * tout autant : le mot suit la forme.
 */
export function motPiste(type: string | null | undefined, nombre: number): string {
  const singulier = estPodcast(type) ? "épisode" : "titre";
  return nombre > 1 ? `${singulier}s` : singulier;
}
