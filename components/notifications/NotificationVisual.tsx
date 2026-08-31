"use client";

import { SafeImage } from "@/components/ui/SafeImage";
import { notificationIcons, notificationTints } from "@/lib/notificationMeta";
import type { NotificationType } from "@/models/Notification";

/**
 * Le visuel d'une notification : la photo ou la pochette de ce dont elle
 * parle, avec un médaillon qui rappelle le type ; à défaut d'image, la
 * pastille d'icône teintée.
 *
 * Rond pour une personne (nouvel abonné, membre), carré arrondi pour une
 * œuvre (son, album, playlist, évènement) — la forme dit déjà, avant la
 * lecture du texte, de quoi il est question.
 */
export function NotificationVisual({
  type,
  imageUrl,
  alt,
  size = 48,
}: {
  type: NotificationType;
  imageUrl?: string | null;
  alt: string;
  size?: number;
}) {
  const Icon = notificationIcons[type];
  const tint = notificationTints[type];
  const shape = type === "new_follower" ? "rounded-full" : "rounded-xl";
  const badge = Math.max(16, Math.round(size * 0.4));

  return (
    <span className="relative block shrink-0" style={{ width: size, height: size }}>
      {imageUrl ? (
        <SafeImage src={imageUrl} alt={alt} width={size} height={size} className={`h-full w-full object-cover ${shape}`} />
      ) : (
        <span className={`grid h-full w-full place-items-center ${shape} ${tint.tile}`}>
          <Icon size={Math.round(size * 0.42)} className={tint.icon} />
        </span>
      )}

      {/* Le médaillon n'a de sens que posé sur une image : sur la pastille,
          il redoublerait l'icône qu'elle porte déjà. */}
      {imageUrl && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full text-base ring-2 ring-surface ${tint.badge}`}
          style={{ width: badge, height: badge }}
        >
          <Icon size={Math.round(badge * 0.58)} />
        </span>
      )}
    </span>
  );
}
