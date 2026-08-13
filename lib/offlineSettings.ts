"use client";

import { idbGet, idbPut, STORES } from "@/lib/offlineDb";

export type AudioQuality = "low" | "medium" | "high";

export type OfflineSettings = {
  audioQuality: AudioQuality; // "low" = 64kb/s, "medium" = 128kb/s, "high" = 320kb/s
  wifiOnlyDownload: boolean;
  autoDownloadFavorites: boolean; // télécharge automatiquement les favoris et les 20 derniers sons écoutés
  storageLimitMB: number; // 0 = illimité
};

export const DEFAULT_OFFLINE_SETTINGS: OfflineSettings = {
  audioQuality: "high",
  wifiOnlyDownload: false,
  autoDownloadFavorites: false,
  storageLimitMB: 0,
};

const SETTINGS_KEY = "offline-settings";

export async function getOfflineSettings(): Promise<OfflineSettings> {
  const stored = await idbGet<{ key: string; value: OfflineSettings }>(STORES.settings, SETTINGS_KEY);
  return { ...DEFAULT_OFFLINE_SETTINGS, ...(stored?.value ?? {}) };
}

export async function setOfflineSettings(settings: Partial<OfflineSettings>): Promise<OfflineSettings> {
  const current = await getOfflineSettings();
  const next = { ...current, ...settings };
  await idbPut(STORES.settings, { key: SETTINGS_KEY, value: next });
  window.dispatchEvent(new Event("moziik-offline-settings-change"));
  return next;
}

/**
 * Insère le paramètre de bitrate Cloudinary dans l'URL audio selon la
 * qualité choisie (transformation à la volée, pas de re-upload).
 */
export function applyAudioQuality(audioUrl: string, quality: AudioQuality): string {
  const bitrate = { low: "64k", medium: "128k", high: "320k" }[quality];
  if (!audioUrl.includes("/upload/")) return audioUrl;
  return audioUrl.replace("/upload/", `/upload/br_${bitrate}/`);
}

/** true si le navigateur signale une connexion Wi-Fi (repli permissif si l'API n'est pas dispo). */
export function isOnWifi(): boolean {
  const connection = (navigator as unknown as { connection?: { type?: string; effectiveType?: string } })
    .connection;
  if (!connection) return true; // API Network Information non supportée : on ne bloque pas
  return connection.type ? connection.type === "wifi" : true;
}
