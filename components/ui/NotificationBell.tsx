"use client";

import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { useSession } from "next-auth/react";
import { useNotifications } from "@/context/NotificationsProvider";

/**
 * variant="desktop" : ouvre le panneau latéral (NotificationsDrawer, monté
 * une seule fois au niveau du layout).
 * variant="mobile" : redirige vers la page dédiée /notifications — pas de
 * panneau flottant sur mobile.
 */
export function NotificationBell({ variant }: { variant: "desktop" | "mobile" }) {
  const { status } = useSession();
  const router = useRouter();
  const { unreadCount, toggleDrawer } = useNotifications();

  if (status !== "authenticated") return null;

  const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <button
      onClick={() => (variant === "desktop" ? toggleDrawer() : router.push("/notifications"))}
      aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} non lues` : "Notifications"}
      className="relative grid h-9 w-9 place-items-center rounded-full border border-border transition-colors hover:border-accent"
    >
      <Bell size={16} />
      {unreadCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-accent px-1 text-[10px] font-medium leading-none text-base">
          {badgeLabel}
        </span>
      )}
    </button>
  );
}
