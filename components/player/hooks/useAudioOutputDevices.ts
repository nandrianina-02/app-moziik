"use client";

import { useCallback, useEffect, useState } from "react";

export type AudioOutputDevice = { deviceId: string; label: string };

/**
 * Liste les sorties audio disponibles et se tient à jour quand du matériel
 * est branché/débranché (évènement `devicechange`).
 *
 * Particularité de l'API : par défaut le navigateur renvoie bien les
 * périphériques, mais avec un `label` vide — les noms ("Casque Bluetooth",
 * "Haut-parleurs"...) sont considérés comme identifiants et ne sont exposés
 * qu'après une autorisation d'accès aux périphériques audio. D'où
 * `needsPermission` / `requestLabels`, plutôt qu'une demande d'autorisation
 * imposée à l'ouverture du menu.
 *
 * Appelé au montage du menu uniquement : inutile d'interroger le matériel
 * sur chaque page.
 */
export function useAudioOutputDevices() {
  const [devices, setDevices] = useState<AudioOutputDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsPermission, setNeedsPermission] = useState(false);

  const refresh = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      setDevices([]);
      setLoading(false);
      return;
    }
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const outputs = all
        .filter((device) => device.kind === "audiooutput")
        .map((device) => ({ deviceId: device.deviceId, label: device.label }));
      setDevices(outputs);
      setNeedsPermission(outputs.length > 0 && outputs.every((device) => !device.label));
    } catch {
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const media = navigator.mediaDevices;
    if (!media?.addEventListener) return;
    media.addEventListener("devicechange", refresh);
    return () => media.removeEventListener("devicechange", refresh);
  }, [refresh]);

  /**
   * Seul moyen prévu par la spec d'obtenir les noms des sorties : ouvrir
   * puis refermer aussitôt un flux d'entrée. Le micro n'est jamais gardé
   * ouvert (getTracks().stop()), il ne sert qu'à lever l'anonymat.
   */
  const requestLabels = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    await refresh();
  }, [refresh]);

  return { devices, loading, needsPermission, requestLabels, refresh };
}
