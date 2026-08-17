"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { X, Trash2 } from "lucide-react";
import { notificationIcons } from "@/lib/notificationMeta";
import { useNotifications } from "@/context/NotificationsProvider";

/**
 * Toujours monté dans l'arbre (une seule instance, au niveau du layout,
 * en parallèle de la sidebar) pour permettre une animation de sortie —
 * un rendu conditionnel avec {open && <Drawer/>} ne pourrait pas animer
 * la fermeture. Visible/invisible via un translate CSS.
 */
export function NotificationsDrawer() {
  const { items, loading, drawerOpen, closeDrawer, markRead, markAllRead, deleteNotification } = useNotifications();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeDrawer();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen, closeDrawer]);

  useEffect(() => {
    if (!drawerOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) closeDrawer();
    }
    // mousedown + léger délai pour ne pas capter le clic qui vient d'ouvrir le panneau
    const id = setTimeout(() => document.addEventListener("mousedown", handleClickOutside), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [drawerOpen, closeDrawer]);

  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <div
      // `overflow-hidden` : fermé, le panneau est décalé de sa propre
      // largeur (`translate-x-full`) et dépasse donc de 384 px à droite du
      // cadre. Le clipping est ici la bonne réponse — le panneau est
      // *censé* être hors écran — mais il doit être explicite, sinon le
      // dépassement se voit au zoom et sur les navigateurs qui comptent
      // les éléments fixes dans la zone défilante.
      className={`fixed inset-0 z-50 hidden overflow-hidden md:block ${drawerOpen ? "" : "pointer-events-none"}`}
      aria-hidden={!drawerOpen}
    >
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${
          drawerOpen ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        className={`absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-border bg-surface shadow-2xl transition-transform duration-300 ease-out ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <span className="text-sm font-medium">Notifications</span>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-accent hover:underline">
                Tout marquer comme lu
              </button>
            )}
            <button onClick={closeDrawer} aria-label="Fermer" className="text-ink-muted hover:text-ink">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <p className="px-5 py-6 text-sm text-ink-muted">Chargement...</p>}
          {!loading && items.length === 0 && (
            <p className="px-5 py-6 text-sm text-ink-muted">Aucune notification pour l&apos;instant.</p>
          )}

          <ul>
            {items.map((n) => {
              const Icon = notificationIcons[n.type];
              return (
                <li key={n._id} className="group relative border-b border-border/60">
                  <Link
                    href={n.link ?? "/notifications"}
                    onClick={() => {
                      if (!n.read) markRead(n._id);
                      closeDrawer();
                    }}
                    className={`flex items-start gap-3 px-5 py-3.5 pr-11 text-sm transition-colors hover:bg-base ${
                      n.read ? "opacity-60" : ""
                    }`}
                  >
                    {!n.read && <span className="absolute left-2 top-5 h-1.5 w-1.5 rounded-full bg-accent" />}
                    <Icon size={16} className="mt-0.5 shrink-0 text-accent" />
                    <span className="min-w-0">
                      <span className="block font-medium">{n.title}</span>
                      <span className="block truncate text-xs text-ink-muted">{n.message}</span>
                    </span>
                  </Link>
                  <button
                    onClick={() => deleteNotification(n._id)}
                    aria-label="Supprimer la notification"
                    className="absolute right-3 top-3.5 text-ink-muted opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <Link
          href="/notifications"
          onClick={closeDrawer}
          className="block border-t border-border px-5 py-3.5 text-center text-xs text-accent hover:underline"
        >
          Voir toutes les notifications
        </Link>
      </div>
    </div>
  );
}
