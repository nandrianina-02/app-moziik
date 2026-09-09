"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import type { INotification } from "@/models/Notification";

export type NotificationItem = INotification & { _id: string };

type NotificationsContextValue = {
  items: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  deleteAll: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

// Pas d'infrastructure temps réel (websocket/SSE) côté serveur : on
// s'approche du "temps réel" par un rafraîchissement périodique + à
// chaque retour de focus sur l'onglet, en plus des mises à jour
// optimistes immédiates après une action de l'utilisateur.
const POLL_INTERVAL_MS = 30_000;

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hasLoadedOnce = useRef(false);

  // Recharge la première page depuis le début (utilisé au montage, au
  // polling périodique, et au retour de focus sur l'onglet).
  const refresh = useCallback(async () => {
    if (status !== "authenticated") return;
    if (!hasLoadedOnce.current) setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.notifications);
      setHasMore(Boolean(data.hasMore));
    } catch {
      // Échec silencieux pour le rafraîchissement périodique : on garde
      // la dernière liste connue plutôt que de casser l'affichage.
    } finally {
      hasLoadedOnce.current = true;
      setLoading(false);
    }
  }, [status]);

  // Charge la page suivante (curseur = date du plus ancien élément déjà
  // en mémoire) et l'ajoute à la suite de la liste courante.
  const loadMore = useCallback(async () => {
    if (status !== "authenticated" || loadingMore || !hasMore || items.length === 0) return;
    setLoadingMore(true);
    try {
      const cursor = items[items.length - 1]?.createdAt;
      const res = await fetch(`/api/notifications?before=${encodeURIComponent(new Date(cursor).toISOString())}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems((prev) => [...prev, ...data.notifications]);
      setHasMore(Boolean(data.hasMore));
    } catch {
      // Échec silencieux : l'utilisateur peut retenter via le bouton "Charger plus".
    } finally {
      setLoadingMore(false);
    }
  }, [status, loadingMore, hasMore, items]);

  useEffect(() => {
    if (status !== "authenticated") {
      setItems([]);
      return;
    }
    refresh();

    // Rien tant que l'onglet est caché — application en arrière-plan,
    // écran éteint, onglet oublié. Le rafraîchissement au retour de focus
    // juste en dessous rattrape tout ce qui a été manqué en une requête,
    // là où le battement en dépensait cent vingt par heure pour un écran
    // que personne ne regardait. C'est la règle que suivent déjà
    // MessagesProvider, MessagerieClient et FilDiscussion ; celui-ci
    // était le seul à y échapper.
    const interval = setInterval(() => {
      if (!document.hidden) refresh();
    }, POLL_INTERVAL_MS);
    function handleFocus() {
      refresh();
    }
    // `visibilitychange` en plus de `focus` : sur téléphone, revenir dans
    // l'application depuis l'écran d'accueil ne déclenche pas toujours
    // `focus`. Sans lui, suspendre le battement quand l'onglet est caché
    // rendrait les notifications plus lentes au lieu de simplement moins
    // coûteuses.
    function handleVisibility() {
      if (!document.hidden) refresh();
    }
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [status, refresh]);

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    await fetch(`/api/notifications/${id}/read`, { method: "POST" }).catch(() => {});
  }

  async function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications/read-all", { method: "POST" }).catch(() => {});
  }

  async function deleteNotification(id: string) {
    const previous = items;
    setItems((prev) => prev.filter((n) => n._id !== id));
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setItems(previous); // on restaure si la suppression échoue côté serveur
    }
  }

  async function deleteAll() {
    const previous = items;
    setItems([]);
    setHasMore(false);
    try {
      const res = await fetch("/api/notifications", { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setItems(previous); // on restaure si la suppression échoue côté serveur
    }
  }

  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <NotificationsContext.Provider
      value={{
        items,
        unreadCount,
        loading,
        loadingMore,
        hasMore,
        drawerOpen,
        openDrawer: () => setDrawerOpen(true),
        closeDrawer: () => setDrawerOpen(false),
        toggleDrawer: () => setDrawerOpen((v) => !v),
        refresh,
        loadMore,
        markRead,
        markAllRead,
        deleteNotification,
        deleteAll,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications doit être utilisé sous NotificationsProvider.");
  return ctx;
}
