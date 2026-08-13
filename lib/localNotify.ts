"use client";

export async function notifyDownloadComplete(label: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;

  if (Notification.permission === "default") {
    await Notification.requestPermission().catch(() => {});
  }
  if (Notification.permission !== "granted") return;

  // Si l'onglet est déjà au premier plan, une notification système est
  // superflue et intrusive — on la réserve au cas où l'app est en fond.
  if (document.visibilityState === "visible") return;

  new Notification("Téléchargement terminé", { body: label, icon: "/icon-192.png" });
}
