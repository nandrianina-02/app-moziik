"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  ChevronDown,
} from "lucide-react";
import { notificationActionLabels } from "@/lib/notificationMeta";
import { EqualizerLoader } from "@/components/ui/EqualizerLoader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ContextMenuShell, MenuItem } from "@/components/ui/ContextMenuShell";
import { NotificationVisual } from "@/components/notifications/NotificationVisual";
import { useNotifications, type NotificationItem } from "@/context/NotificationsProvider";
import type { NotificationType } from "@/models/Notification";

// Sept filtres par type tenaient sur un écran de bureau, jamais sur un
// téléphone : au-delà de trois ou quatre, la rangée devient un ruban qu'on
// fait défiler sans jamais voir ce qu'on cherche. Les types sont donc
// regroupés par ce qu'ils racontent — la musique, les gens, la plateforme —
// et aucun ne se retrouve hors d'atteinte.
type TabValue = "all" | "unread" | "music" | "social" | "system";

const tabTypes: Record<Exclude<TabValue, "all" | "unread">, NotificationType[]> = {
  music: ["new_song", "event"],
  social: ["new_follower", "like", "comment", "message"],
  system: ["payment", "system"],
};

const tabs: { value: TabValue; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "unread", label: "Non lues" },
  { value: "music", label: "Musique" },
  { value: "social", label: "Social" },
  { value: "system", label: "Système" },
];

type SortKey = "recent" | "oldest" | "unread";

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Les plus récentes" },
  { value: "oldest", label: "Les plus anciennes" },
  { value: "unread", label: "Non lues d'abord" },
];

const HIDE_READ_STORAGE_KEY = "moziik-notifications-hide-read";

function matchesTab(notification: NotificationItem, tab: TabValue) {
  if (tab === "all") return true;
  if (tab === "unread") return !notification.read;
  return tabTypes[tab].includes(notification.type);
}

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
  const [tab, setTab] = useState<TabValue>("all");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [sortOpen, setSortOpen] = useState(false);
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

  const unreadCount = items.filter((n) => !n.read).length;

  const counts = useMemo<Record<TabValue, number>>(
    () => ({
      all: items.length,
      unread: unreadCount,
      music: items.filter((n) => tabTypes.music.includes(n.type)).length,
      social: items.filter((n) => tabTypes.social.includes(n.type)).length,
      system: items.filter((n) => tabTypes.system.includes(n.type)).length,
    }),
    [items, unreadCount]
  );

  // Le tri porte sur ce qui est chargé — le scroll infini continue de
  // rapporter les notifications de la plus récente à la plus ancienne, quel
  // que soit l'ordre affiché.
  const visible = useMemo(() => {
    const list = items.filter((n) => matchesTab(n, tab)).filter((n) => !hideRead || !n.read);
    const byDate = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (sortKey === "oldest") byDate.reverse();
    if (sortKey === "unread") return byDate.sort((a, b) => Number(a.read) - Number(b.read));
    return byDate;
  }, [items, tab, hideRead, sortKey]);

  const groups = useMemo(() => {
    // Ranger par période une liste triée « non lues d'abord » découperait
    // justement ce que ce tri rassemble : les deux états font alors les
    // deux sections.
    if (sortKey === "unread") {
      return [
        { label: "Non lues", items: visible.filter((n) => !n.read) },
        { label: "Déjà lues", items: visible.filter((n) => n.read) },
      ].filter((g) => g.items.length > 0);
    }
    const periods = groupByPeriod(visible);
    return sortKey === "oldest" ? periods.reverse() : periods;
  }, [visible, sortKey]);

  async function handleDeleteAll() {
    setDeletingAll(true);
    await deleteAll();
    setDeletingAll(false);
    setConfirmDeleteAll(false);
  }

  function openSettingsFromFooter() {
    setSettingsOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 md:px-10 md:py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display sm:text-3xl">Notifications</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {items.length > 0 ? "Reste informé de tout ce qui compte." : "Aucune notification pour l'instant."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              aria-haspopup="true"
              aria-expanded={settingsOpen}
              className="flex items-center gap-1.5 rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
            >
              <Settings2 size={15} /> Paramètres
            </button>
            <AnimatePresence>
              {settingsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-12 z-40 w-64 rounded-xl2 border border-border bg-surface p-4 shadow-2xl"
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
                        className="absolute top-0.5 h-4 w-4 rounded-full bg-ink shadow transition-all"
                        style={{ left: hideRead ? "18px" : "2px" }}
                      />
                    </button>
                  </label>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 rounded-2xl bg-accent px-4 py-2.5 text-sm font-semibold text-base transition-colors hover:bg-accent-hover"
            >
              <CheckCheck size={15} /> Tout marquer comme lu
            </button>
          )}

          {items.length > 0 && (
            <button
              onClick={() => setConfirmDeleteAll(true)}
              aria-label="Supprimer toutes les notifications"
              className="grid h-10 w-10 place-items-center rounded-2xl border border-border bg-surface text-ink-muted transition-colors hover:border-accent hover:text-accent"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Onglets de catégorie + ordre d'affichage */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div role="tablist" aria-label="Catégories" className="flex w-max items-center gap-1 rounded-2xl border border-border bg-surface p-1.5">
            {tabs.map((t) => {
              const active = tab === t.value;
              return (
                <button
                  key={t.value}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.value)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                    active ? "bg-accent/10 text-accent" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {t.label}
                  {counts[t.value] > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        active ? "bg-accent text-base" : "bg-border text-ink-muted"
                      }`}
                    >
                      {counts[t.value]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative shrink-0">
          <button
            onClick={() => setSortOpen((v) => !v)}
            aria-haspopup="true"
            aria-expanded={sortOpen}
            className="flex w-full items-center justify-between gap-2 rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-accent sm:w-auto"
          >
            {sortOptions.find((s) => s.value === sortKey)?.label}
            <ChevronDown size={15} className="text-ink-muted" />
          </button>
          {sortOpen && (
            <div className="absolute right-0 top-12 z-30 w-52 rounded-xl border border-border bg-surface p-1.5 shadow-2xl">
              {sortOptions.map((s) => (
                <button
                  key={s.value}
                  onClick={() => {
                    setSortKey(s.value);
                    setSortOpen(false);
                  }}
                  className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-base ${
                    sortKey === s.value ? "font-medium text-accent" : "text-ink-muted"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
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

      <div className="stagger flex flex-col gap-6">
        {groups.map((group) => (
          <section key={group.label}>
            <h2 className="mb-2.5 px-1 text-xs font-medium uppercase tracking-wide text-ink-muted">{group.label}</h2>
            <ul className="overflow-hidden rounded-xl2 border border-border bg-surface">
              <AnimatePresence initial={false}>
                {group.items.map((n) => (
                  <NotificationRow
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

      {items.length > 0 && (
        <p className="mt-8 flex flex-wrap items-center justify-center gap-1.5 text-center text-xs text-ink-muted">
          <Bell size={14} className="shrink-0" />
          Tu reçois trop de notifications ?
          <button onClick={openSettingsFromFooter} className="font-medium text-accent hover:underline">
            Ajuste tes préférences
          </button>
        </p>
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

function NotificationRow({
  notification,
  onOpenMenu,
  markRead,
}: {
  notification: NotificationItem;
  onOpenMenu: (x: number, y: number) => void;
  markRead: (id: string) => Promise<void>;
}) {
  const actionLabel = notificationActionLabels[notification.type];
  const songId = notification.type === "new_song" ? songIdFromLink(notification.link) : undefined;
  const hasActions = Boolean(songId || (notification.link && actionLabel));

  function handleOpen() {
    if (!notification.read) markRead(notification._id);
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative border-b border-border transition-colors last:border-0 ${
        notification.read ? "hover:bg-base/60" : "bg-accent/[0.06]"
      }`}
    >
      <div className="flex items-start gap-3.5 py-4 pl-3.5 pr-8 sm:pl-4 sm:pr-9">
        <NotificationVisual type={notification.type} imageUrl={notification.imageUrl} alt={notification.title} size={48} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <Link href={notification.link ?? "#"} onClick={handleOpen} className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{notification.title}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{notification.message}</p>
            </Link>

            <div className="flex shrink-0 items-center gap-0.5">
              <span className="whitespace-nowrap text-[11px] text-ink-muted">{timeAgo(notification.createdAt)}</span>
              <button
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  onOpenMenu(rect.right, rect.bottom + 4);
                }}
                aria-label="Plus d'options"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-base hover:text-ink"
              >
                <MoreVertical size={15} />
              </button>
            </div>
          </div>

          {/* Actions rapides. Au doigt elles restent visibles — il n'y a pas
              de survol sur un téléphone ; à la souris elles n'apparaissent
              qu'au survol, pour garder la liste aussi calme que la maquette. */}
          {hasActions && (
            <div className="mt-2.5 flex items-center gap-2 au-survol">
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
            </div>
          )}
        </div>
      </div>

      {!notification.read && (
        <span className="absolute right-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-accent">
          <span className="sr-only">Non lue</span>
        </span>
      )}
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
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border transition-colors ${
        liked ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-ink-muted hover:text-accent"
      }`}
    >
      <Heart size={13} fill={liked ? "currentColor" : "none"} />
    </button>
  );
}
