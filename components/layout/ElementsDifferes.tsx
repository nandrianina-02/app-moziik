"use client";

import dynamic from "next/dynamic";

/**
 * Ce que le layout monte sur toutes les pages sans que rien en soit visible
 * à l'ouverture : le lecteur plein écran, le tiroir des notifications, le
 * mur de quota, le bouton d'installation.
 *
 * Importés directement, ils pesaient dans le JavaScript de chaque première
 * visite — le lecteur plein écran à lui seul embarque la file d'attente,
 * les paroles, les commentaires et les fenêtres de partage. Chargés à part,
 * ils arrivent juste après l'affichage, avant qu'on ait pu les ouvrir.
 *
 * `ssr: false` : aucun n'a de rendu serveur utile, ils sont fermés au
 * premier affichage.
 */
export const FullPlayerPage = dynamic(() => import("@/components/player/FullPlayerPage").then((m) => m.FullPlayerPage), {
  ssr: false,
});
export const NotificationsDrawer = dynamic(
  () => import("@/components/notifications/NotificationsDrawer").then((m) => m.NotificationsDrawer),
  { ssr: false },
);
export const QuotaWall = dynamic(() => import("@/components/player/QuotaWall").then((m) => m.QuotaWall), { ssr: false });
export const FloatingInstallButton = dynamic(
  () => import("@/components/ui/FloatingInstallButton").then((m) => m.FloatingInstallButton),
  { ssr: false },
);
