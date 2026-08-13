"use client";

// Stocke les fichiers audio/pochette dans le Cache Storage du
// navigateur (lu ensuite par le service worker, même hors-ligne) et
// garde les métadonnées dans IndexedDB (lib/offlineDb.ts) — assez
// robuste pour supporter des téléchargements d'albums/playlists
// entiers et un nettoyage intelligent, contrairement au simple
// localStorage utilisé dans la première version.

import { idbGetAll, idbPut, idbDelete, STORES } from "@/lib/offlineDb";
import { getOfflineSettings, applyAudioQuality, isOnWifi } from "@/lib/offlineSettings";
import { notifyDownloadComplete } from "@/lib/localNotify";

const OFFLINE_MEDIA_CACHE = "moziik-offline-media";

export type OfflineSongMeta = {
  _id: string;
  title: string;
  coverUrl: string;
  audioUrl: string;
  duration: number;
  artist: { _id: string; stageName: string; verified?: boolean };
  downloadedAt: number;
  lastPlayedAt?: number;
  source?: "manual" | "album" | "playlist" | "smart-cache"; // pour distinguer l'origine du téléchargement
};

function notifyChange() {
  window.dispatchEvent(new Event("moziik-offline-change"));
}

export async function listOfflineSongs(): Promise<OfflineSongMeta[]> {
  return idbGetAll<OfflineSongMeta>(STORES.songs);
}

export async function isSongOffline(songId: string): Promise<boolean> {
  const songs = await listOfflineSongs();
  return songs.some((s) => s._id === songId);
}

export async function downloadSongForOffline(
  song: Omit<OfflineSongMeta, "downloadedAt">,
  source: OfflineSongMeta["source"] = "manual"
): Promise<void> {
  if (!("caches" in window)) throw new Error("Le mode hors-ligne n'est pas supporté par ce navigateur.");

  const settings = await getOfflineSettings();
  if (settings.wifiOnlyDownload && !isOnWifi()) {
    throw new Error("Téléchargement limité au Wi-Fi dans tes paramètres hors-ligne.");
  }

  const audioUrl = applyAudioQuality(song.audioUrl, settings.audioQuality);

  const cache = await caches.open(OFFLINE_MEDIA_CACHE);
  await Promise.all([cache.add(audioUrl), cache.add(song.coverUrl)]);

  await idbPut<OfflineSongMeta>(STORES.songs, { ...song, audioUrl, downloadedAt: Date.now(), source });
  notifyChange();
}

export async function removeOfflineSong(songId: string): Promise<void> {
  const songs = await listOfflineSongs();
  const song = songs.find((s) => s._id === songId);
  if (!song) return;

  const cache = await caches.open(OFFLINE_MEDIA_CACHE);
  await cache.delete(song.audioUrl);
  await cache.delete(song.coverUrl);

  await idbDelete(STORES.songs, songId);
  notifyChange();
}

/** Marque un son comme écouté maintenant (utilisé par le nettoyage "non écouté depuis 90 jours"). */
export async function markOfflineSongPlayed(songId: string): Promise<void> {
  const songs = await listOfflineSongs();
  const song = songs.find((s) => s._id === songId);
  if (!song) return;
  await idbPut<OfflineSongMeta>(STORES.songs, { ...song, lastPlayedAt: Date.now() });
}

/** Télécharge tous les sons d'un album pour l'écoute hors-ligne. */
export async function downloadAlbumForOffline(
  albumId: string,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const res = await fetch(`/api/albums/${albumId}`);
  if (!res.ok) throw new Error("Impossible de charger l'album.");
  const { album } = await res.json();

  const songs = album.songs as Array<{
    _id: string;
    title: string;
    coverUrl: string;
    audioUrl: string;
    duration: number;
  }>;

  for (let i = 0; i < songs.length; i++) {
    await downloadSongForOffline(
      {
        ...songs[i],
        artist: album.artist
          ? { _id: album.artist._id, stageName: album.artist.stageName, verified: album.artist.verified }
          : { _id: "", stageName: "Artiste supprimé" },
      },
      "album"
    );
    onProgress?.(i + 1, songs.length);
  }
  notifyDownloadComplete(`Album "${album.title}" disponible hors-ligne.`);
}

/** Télécharge tous les sons d'une playlist pour l'écoute hors-ligne. */
export async function downloadPlaylistForOffline(
  playlistId: string,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const res = await fetch(`/api/playlists/${playlistId}`);
  if (!res.ok) throw new Error("Impossible de charger la playlist.");
  const { playlist } = await res.json();

  const songs = playlist.songs as Array<{
    _id: string;
    title: string;
    coverUrl: string;
    audioUrl: string;
    duration: number;
    artist: { _id: string; stageName: string; verified?: boolean };
  }>;

  for (let i = 0; i < songs.length; i++) {
    await downloadSongForOffline(songs[i], "playlist");
    onProgress?.(i + 1, songs.length);
  }
  notifyDownloadComplete(`Playlist "${playlist.title}" disponible hors-ligne.`);
}

/**
 * Un son ne peut pas être mis en cache sans réseau (Cache Storage a
 * besoin de faire la requête). Si l'utilisateur demande un
 * téléchargement hors-ligne, on le met en attente et il démarre tout
 * seul dès que la connexion revient (point 15 du cahier des charges).
 */
export async function queuePendingDownload(song: Omit<OfflineSongMeta, "downloadedAt">): Promise<void> {
  await idbPut(STORES.pendingDownloads, song);
  notifyChange();
}

export async function listPendingDownloads(): Promise<OfflineSongMeta[]> {
  return idbGetAll<OfflineSongMeta>(STORES.pendingDownloads);
}

export async function processPendingDownloads(): Promise<number> {
  const pending = await listPendingDownloads();
  let done = 0;
  for (const song of pending) {
    try {
      await downloadSongForOffline(song, song.source);
      await idbDelete(STORES.pendingDownloads, song._id);
      done += 1;
    } catch {
      // toujours pas de réseau exploitable (ou Wi-Fi requis) : on retentera plus tard
      break;
    }
  }
  return done;
}

/** Espace utilisé par le cache hors-ligne, estimation du navigateur. */
export async function getStorageUsage(): Promise<{ usedMB: number; quotaMB: number } | null> {
  if (!("storage" in navigator) || !navigator.storage.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usedMB: Math.round(usage / 1024 / 1024), quotaMB: Math.round(quota / 1024 / 1024) };
}

/** Supprime les sons hors-ligne non écoutés depuis `days` jours (téléchargement = "écouté" au jour 0). */
export async function cleanupUnplayedSince(days: number): Promise<number> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const songs = await listOfflineSongs();
  const toRemove = songs.filter((s) => (s.lastPlayedAt ?? s.downloadedAt) < cutoff);
  for (const song of toRemove) await removeOfflineSong(song._id);
  return toRemove.length;
}

/** Vide entièrement le cache hors-ligne (médias + métadonnées). */
export async function clearAllOfflineSongs(): Promise<void> {
  const songs = await listOfflineSongs();
  for (const song of songs) await removeOfflineSong(song._id);
}
