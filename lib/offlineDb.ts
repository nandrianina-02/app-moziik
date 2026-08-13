"use client";

// Base de données locale (IndexedDB) qui remplace le simple localStorage
// utilisé jusqu'ici. Sert de fondation à tout le mode hors-ligne :
// sons/albums/artistes mis en cache, historique local, file d'actions
// à synchroniser, paramètres hors-ligne.

const DB_NAME = "moziik-offline";
const DB_VERSION = 2;

export const STORES = {
  songs: "songs",
  albums: "albums",
  artists: "artists",
  playlists: "playlistsCache",
  history: "history",
  syncQueue: "syncQueue",
  settings: "settings",
  pendingDownloads: "pendingDownloads",
} as const;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB non supporté par ce navigateur."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.songs)) {
        db.createObjectStore(STORES.songs, { keyPath: "_id" });
      }
      if (!db.objectStoreNames.contains(STORES.albums)) {
        db.createObjectStore(STORES.albums, { keyPath: "_id" });
      }
      if (!db.objectStoreNames.contains(STORES.artists)) {
        db.createObjectStore(STORES.artists, { keyPath: "_id" });
      }
      if (!db.objectStoreNames.contains(STORES.playlists)) {
        db.createObjectStore(STORES.playlists, { keyPath: "_id" });
      }
      if (!db.objectStoreNames.contains(STORES.history)) {
        const store = db.createObjectStore(STORES.history, { keyPath: "localId", autoIncrement: true });
        store.createIndex("playedAt", "playedAt");
      }
      if (!db.objectStoreNames.contains(STORES.syncQueue)) {
        db.createObjectStore(STORES.syncQueue, { keyPath: "localId", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORES.pendingDownloads)) {
        db.createObjectStore(STORES.pendingDownloads, { keyPath: "_id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbPut<T>(store: string, value: T): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbGet<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetAll<T>(store: string): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbDelete(store: string, key: IDBValidKey): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbClear(store: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
