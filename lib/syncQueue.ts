"use client";

import { idbGetAll, idbPut, idbDelete, STORES } from "@/lib/offlineDb";

export type SyncAction =
  | { type: "like_song"; songId: string; liked: boolean }
  | { type: "add_comment"; songId: string; text: string; timestampInSong?: number }
  | { type: "create_playlist"; tempId: string; title: string; isPublic?: boolean }
  | { type: "rename_playlist"; playlistId: string; title: string }
  | { type: "delete_playlist"; playlistId: string }
  | { type: "add_song_to_playlist"; playlistId: string; songId: string }
  | { type: "remove_song_from_playlist"; playlistId: string; songId: string }
  | { type: "record_play"; songId: string; secondsListened: number; completed: boolean };

type QueuedAction = SyncAction & { localId?: number; queuedAt: number };

export async function enqueueSyncAction(action: SyncAction): Promise<void> {
  await idbPut<QueuedAction>(STORES.syncQueue, { ...action, queuedAt: Date.now() });
  window.dispatchEvent(new Event("moziik-sync-queue-change"));
}

export async function getQueuedActions(): Promise<QueuedAction[]> {
  return idbGetAll<QueuedAction>(STORES.syncQueue);
}

async function sendAction(action: SyncAction): Promise<boolean> {
  try {
    switch (action.type) {
      case "like_song": {
        // Le endpoint bascule l'état ; on rejoue simplement la
        // bascule demandée telle qu'elle a été faite hors-ligne.
        const res = await fetch(`/api/songs/${action.songId}/like`, { method: "POST" });
        return res.ok;
      }
      case "add_comment": {
        const res = await fetch(`/api/songs/${action.songId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: action.text, timestampInSong: action.timestampInSong }),
        });
        return res.ok;
      }
      case "create_playlist": {
        const res = await fetch("/api/playlists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: action.title, isPublic: action.isPublic }),
        });
        return res.ok;
      }
      case "rename_playlist": {
        const res = await fetch(`/api/playlists/${action.playlistId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: action.title }),
        });
        return res.ok;
      }
      case "delete_playlist": {
        const res = await fetch(`/api/playlists/${action.playlistId}`, { method: "DELETE" });
        return res.ok;
      }
      case "add_song_to_playlist": {
        const res = await fetch(`/api/playlists/${action.playlistId}/songs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ songId: action.songId }),
        });
        return res.ok;
      }
      case "remove_song_from_playlist": {
        const res = await fetch(`/api/playlists/${action.playlistId}/songs`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ songId: action.songId }),
        });
        return res.ok;
      }
      case "record_play": {
        const res = await fetch(`/api/songs/${action.songId}/play`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secondsListened: action.secondsListened,
            completed: action.completed,
            device: "web-offline-sync",
          }),
        });
        return res.ok;
      }
      default:
        return true;
    }
  } catch {
    return false; // toujours hors-ligne ou erreur réseau : on retente plus tard
  }
}

/**
 * Rejoue dans l'ordre toutes les actions en attente. S'arrête à la
 * première qui échoue encore (probablement toujours hors-ligne) pour
 * ne pas désynchroniser l'ordre, et réessaiera au prochain appel.
 */
export async function flushSyncQueue(): Promise<{ synced: number; remaining: number }> {
  const queued = await getQueuedActions();
  let synced = 0;

  for (const action of queued) {
    if (action.localId === undefined) continue;
    const ok = await sendAction(action);
    if (!ok) break;
    await idbDelete(STORES.syncQueue, action.localId);
    synced += 1;
  }

  window.dispatchEvent(new Event("moziik-sync-queue-change"));
  const remaining = (await getQueuedActions()).length;
  return { synced, remaining };
}
