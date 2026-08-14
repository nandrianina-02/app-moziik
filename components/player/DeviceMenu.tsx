"use client";

import { useState } from "react";
import { Check, Headphones, Loader2, MonitorSpeaker } from "lucide-react";
import { ContextMenuShell } from "@/components/ui/ContextMenuShell";
import type { MenuAnchor } from "@/components/ui/useClampedMenuPosition";
import { usePlayer } from "@/context/PlayerProvider";
import { useToast } from "@/context/ToastProvider";
import { useAudioOutputDevices } from "@/components/player/hooks/useAudioOutputDevices";

/** Un casque se distingue d'une enceinte au premier coup d'œil. */
function deviceIcon(label: string) {
  return /casque|headphone|headset|earbud|airpod/i.test(label) ? Headphones : MonitorSpeaker;
}

function deviceName(device: { deviceId: string; label: string }, index: number) {
  if (device.label) return device.label;
  // Libellés masqués faute d'autorisation : on reste explicite plutôt que
  // d'afficher une ligne vide.
  if (device.deviceId === "default") return "Sortie par défaut";
  return `Périphérique ${index + 1}`;
}

export function DeviceMenu({ anchor, onClose }: { anchor: MenuAnchor; onClose: () => void }) {
  const { outputDeviceId, setOutputDevice } = usePlayer();
  const pushToast = useToast();
  const { devices, loading, needsPermission, requestLabels } = useAudioOutputDevices();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [askingLabels, setAskingLabels] = useState(false);

  // Sans choix explicite, c'est l'entrée "default" du système qui joue :
  // c'est donc elle qu'il faut cocher, pas une ligne fictive.
  const selectedId = outputDeviceId || devices.find((d) => d.deviceId === "default")?.deviceId || "";

  async function choose(deviceId: string, label: string) {
    if (deviceId === selectedId) {
      onClose();
      return;
    }
    setBusyId(deviceId);
    try {
      await setOutputDevice(deviceId);
      pushToast("success", `Sortie audio : ${label}`);
      onClose();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Impossible d'utiliser cette sortie.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRequestLabels() {
    setAskingLabels(true);
    try {
      await requestLabels();
    } catch {
      pushToast("error", "Autorisation refusée : les noms des appareils restent masqués.");
    } finally {
      setAskingLabels(false);
    }
  }

  return (
    <ContextMenuShell anchor={anchor} onClose={onClose} width={272}>
      <p className="px-4 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
        Sortie audio
      </p>

      {loading && (
        <p className="flex items-center gap-2 px-4 py-2 text-sm text-ink-muted">
          <Loader2 size={14} className="animate-spin" />
          Recherche des appareils...
        </p>
      )}

      {!loading && devices.length === 0 && (
        <p className="px-4 py-2 text-sm text-ink-muted">Aucune sortie audio détectée.</p>
      )}

      <ul className="max-h-64 overflow-y-auto">
        {devices.map((device, index) => {
          const label = deviceName(device, index);
          const Icon = deviceIcon(device.label);
          const isSelected = device.deviceId === selectedId;
          return (
            <li key={device.deviceId}>
              <button
                onClick={() => choose(device.deviceId, label)}
                disabled={busyId !== null}
                className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors hover:bg-base disabled:opacity-60 ${
                  isSelected ? "text-accent" : ""
                }`}
              >
                <Icon size={15} className={isSelected ? "text-accent" : "text-ink-muted"} />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {busyId === device.deviceId ? (
                  <Loader2 size={14} className="shrink-0 animate-spin text-ink-muted" />
                ) : (
                  isSelected && <Check size={14} className="shrink-0 text-accent" />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {needsPermission && (
        <>
          <div className="my-1.5 h-px bg-border" />
          <div className="px-4 pb-1.5">
            <p className="text-[11px] leading-snug text-ink-muted">
              Le navigateur masque le nom des appareils tant que l&apos;accès audio n&apos;est pas autorisé.
            </p>
            <button
              onClick={handleRequestLabels}
              disabled={askingLabels}
              className="mt-2 w-full rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-base disabled:opacity-60"
            >
              {askingLabels ? "Autorisation en cours..." : "Afficher les noms"}
            </button>
          </div>
        </>
      )}
    </ContextMenuShell>
  );
}
