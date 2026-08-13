"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2,
  Check,
  CheckCheck,
  Settings2,
  MoreVertical,
  Heart,
  Play,
  Bell,
} from "lucide-react";
import { notificationIcons, notificationLabels, notificationActionLabels } from "@/lib/notificationMeta";
import { EqualizerLoader } from "@/components/ui/EqualizerLoader";
import { SafeImage } from "@/components/ui/SafeImage";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ContextMenuShell, MenuItem } from "@/components/ui/ContextMenuShell";
import { useNotifications, type NotificationItem } from "@/context/NotificationsProvider";
import type { NotificationType } from "@/models/Notification";

const filters: Array<{ value: NotificationType | "all"; label: string }> = [
  { value: "all", label: "Tout" },
  { value: "new_song", label: notificationLabels.new_song },
  { value: "new_follower", label: notificationLabels.new_follower },
  { value: "like", label: notificationLabels.like },
  { value: "comment", label: notificationLabels.comment },
  { value: "event", label: notificationLabels.event },
  { value: "payment", label: notificationLabels.payment },
  { value: "system", label: notificationLabels.system },
];

const HIDE_READ_STORAGE_KEY = "moziik-notifications-hide-read";

/** Regroupe les notifications par période relative, dans l'ordre d'affichage voulu. */
function groupByPeriod(items: NotificationItem[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  const startOfMonth = new Date(startOfToday);
  startOfMonth.setDate(startOfMonth.getDate() - 30);

  const groups: { label: string; items: NotificationItem[] }[] = [
    { label: "Aujourd'hui", items: [] },
    { label: "Hier", items: [] },
    { label: "Cette semaine", items: [] },
    { label: "Ce mois-ci", items: [] },
    { label: "Plus ancien", items: [] },
  ];

  for (const item of items) {
    const createdAt = new Date(item.createdAt);
    if (createdAt >= startOfToday) groups[0].items.push(item);
    else if (createdAt >= startOfYesterday) groups[1].items.push(item);
    else if (createdAt >= startOfWeek) groups[2].items.push(item);
    else if (createdAt >= startOfMonth) groups[3].items.push(item);
    else groups[4].items.push(item);
  }

  return groups.filter((g) => g.items.length > 0);
}

/** Formate une date en "il y a X min/h/j", sans dépendance externe. */
function timeAgo(date: string | Date) {
  const diffMs = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Extrait un id de son depuis un lien de notification du type "/son/<id>". */
function songIdFromLink(link?: string) {
  const match = link?.match(/^\/son\/([^/?#]+)/);
  return match?.[1];
}

export function NotificationsPageContent() {
  const { items, loading, loadingMore, hasMore, markRead, markAllRead, deleteNotification, deleteAll, loadMore } =
    useNotifications();
  const [filter, setFilter] = useState<NotificationType | "all">("all");
  const [hideRead, setHideRead] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [openMenuFor, setOpenMenuFor] = useState<{ id: string; x: number; y: number } | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(HIDE_READ_STORAGE_KEY);
    if (stored === "1") setHideRead(true);
  }, []);

  function toggleHideRead() {
    setHideRead((prev) => {
      const next = !prev;
      window.localStorage.setItem(HIDE_READ_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  // Scroll infini : dès que la sentinelle en bas de liste devient visible,
  // on demande la page suivante (si disponible côté API).
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const visible = items
    .filter((n) => filter === "all" || n.type === filter)
    .filter((n) => !hideRead || !n.read);

  const groups = groupByPeriod(visible);
  const unreadCount = items.filter((n) => !n.read).length;

  async function handleDeleteAll() {
    setDeletingAll(true);
    await deleteAll();
    setDeletingAll(false);
    setConfirmDeleteAll(false);
  }

  return (
    <div className="px-6 py-8 md:px-10 md:py-10 max-w-3xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display">Notifications</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {items.length > 0 ? (
              <>
                <span className="font-medium text-accent">{items.length} notification{items.length > 1 ? "s" : ""}</span>
                {" · "}
                {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
              </>
            ) : (
              "Aucune notification pour l'instant."
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-2 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent"
            >
              <CheckCheck size={14} /> Tout marquer comme lu
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              aria-label="Paramètres des notifications"
              className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface text-ink-muted transition-colors hover:text-ink"
            >
              <Settings2 size={15} />
            </button>
            <AnimatePresence>
              {settingsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-11 z-40 w-64 rounded-xl2 border border-border bg-surface p-4 shadow-2xl"
                >
                  <p className="mb-3 text-sm font-medium text-ink">Affichage</p>
                  <label className="flex items-center justify-between gap-3">
                    <span className="text-xs text-ink-muted">Masquer les notifications déjà lues</span>
                    <button
                      role="switch"
                      aria-checked={hideRead}
                      onClick={toggleHideRead}
                      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                        hideRead ? "bg-accent" : "bg-border"
                      }`}
                    >
                      <span
                        className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
                        style={{ left: hideRead ? "18px" : "2px" }}
                      />
                    </button>
                  </label>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {items.length > 0 && (
            <button
              onClick={() => setConfirmDeleteAll(true)}
              aria-label="Supprimer toutes les notifications"
              className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface text-ink-muted transition-colors hover:border-accent hover:text-accent"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Filtres par catégorie */}
      <div className="-mx-6 mb-6 overflow-x-auto px-6 md:-mx-10 md:px-10">
        <div className="flex w-max gap-2">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors border ${
                filter === f.value
                  ? "bg-accent text-base border-accent"
                  : "border-border bg-surface text-ink-muted hover:border-accent hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="grid place-items-center py-16">
          <EqualizerLoader />
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl2 border border-dashed border-border py-16 text-center">
          <Bell size={28} className="text-ink-muted" />
          <p className="text-sm text-ink-muted">Rien à afficher pour ce filtre.</p>
        </div>
      )}

      <div className="stagger flex flex-col gap-7">
        {groups.map((group) => (
          <section key={group.label}>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-muted">{group.label}</h2>
            <ul className="flex flex-col gap-2.5">
              <AnimatePresence initial={false}>
                {group.items.map((n) => (
                  <NotificationCard
                    key={n._id}
                    notification={n}
                    onOpenMenu={(x, y) => setOpenMenuFor({ id: n._id, x, y })}
                    markRead={markRead}
                  />
                ))}
              </AnimatePresence>
            </ul>
          </section>
        ))}
      </div>

      {/* Sentinelle de scroll infini */}
      {hasMore && !loading && (
        <div ref={sentinelRef} className="grid place-items-center py-8">
          {loadingMore && <EqualizerLoader size="sm" />}
        </div>
      )}

      {openMenuFor && (
        <ContextMenuShell anchor={{ x: openMenuFor.x, y: openMenuFor.y }} onClose={() => setOpenMenuFor(null)} width={200}>
          {!items.find((n) => n._id === openMenuFor.id)?.read && (
            <MenuItem
              icon={Check}
              label="Marquer comme lu"
              onClick={() => {
                markRead(openMenuFor.id);
                setOpenMenuFor(null);
              }}
            />
          )}
          <MenuItem
            icon={Trash2}
            label="Supprimer"
            danger
            onClick={() => {
              deleteNotification(openMenuFor.id);
              setOpenMenuFor(null);
            }}
          />
        </ContextMenuShell>
      )}

      {confirmDeleteAll && (
        <ConfirmDialog
          title="Supprimer toutes les notifications ?"
          description="Cette action est irréversible : tout ton historique de notifications sera définitivement supprimé."
          confirmLabel="Tout supprimer"
          busy={deletingAll}
          onConfirm={handleDeleteAll}
          onCancel={() => setConfirmDeleteAll(false)}
        />
      )}
    </div>
  );
}

function NotificationCard({
  notification,
  onOpenMenu,
  markRead,
}: {
  notification: NotificationItem;
  onOpenMenu: (x: number, y: number) => void;
  markRead: (id: string) => Promise<void>;
}) {
  const Icon = notificationIcons[notification.type];
  const actionLabel = notificationActionLabels[notification.type];
  const songId = notification.type === "new_song" ? songIdFromLink(notification.link) : undefined;

  function handleOpen() {
    if (!notification.read) markRead(notification._id);
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`relative flex items-center gap-3.5 rounded-xl2 border px-4 py-3.5 transition-colors ${
        notification.read ? "border-border bg-surface" : "border-accent/25 bg-accent/[0.06]"
      }`}
    >
      {!notification.read && <span className="absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-accent" />}

      {/* Visuel : pochette/avatar si disponible, sinon icône du type */}
      <div className="relative shrink-0">
        {notification.imageUrl ? (
          <SafeImage
            src={notification.imageUrl}
            alt={notification.title}
            width={48}
            height={48}
            className="h-12 w-12 rounded-xl object-cover"
          />
        ) : (
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-accent/10">
            <Icon size={20} className="text-accent" />
          </div>
        )}
        {notification.imageUrl && (
          <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-white ring-2 ring-surface">
            <Icon size={11} />
          </span>
        )}
      </div>

      {/* Texte */}
      <Link href={notification.link ?? "#"} onClick={handleOpen} className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{notification.title}</p>
        <p className="truncate text-xs text-ink-muted">{notification.message}</p>
        <p className="mt-0.5 text-[11px] text-ink-muted">{timeAgo(notification.createdAt)}</p>
      </Link>

      {/* Actions rapides */}
      <div className="flex shrink-0 items-center gap-1.5">
        {songId && <LikeQuickAction songId={songId} />}

        {notification.link && actionLabel && (
          <Link
            href={notification.link}
            onClick={handleOpen}
            className={`flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              notification.type === "new_song"
                ? "bg-accent text-base hover:bg-accent-hover"
                : "border border-border text-ink hover:border-ink-muted"
            }`}
          >
            {notification.type === "new_song" && <Play size={12} fill="currentColor" />}
            {actionLabel}
          </Link>
        )}

        <button
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            onOpenMenu(rect.right, rect.bottom + 4);
          }}
          aria-label="Plus d'options"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-base hover:text-ink"
        >
          <MoreVertical size={15} />
        </button>
      </div>
    </motion.li>
  );
}

/** Bouton cœur rapide, pour aimer/retirer un morceau directement depuis sa notification. */
function LikeQuickAction({ songId }: { songId: string }) {
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/songs/${songId}/like`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setLiked(Boolean(data.liked));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [songId]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const previous = liked;
    setLiked(!previous); // optimiste
    try {
      const res = await fetch(`/api/songs/${songId}/like`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLiked(Boolean(data.liked));
    } catch {
      setLiked(previous);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={liked ? "Retirer le like" : "Aimer ce morceau"}
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-colors ${
        liked ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-ink-muted hover:text-accent"
      }`}
    >
      <Heart size={14} fill={liked ? "currentColor" : "none"} />
    </button>
  );
}
