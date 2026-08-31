import { Music, UserPlus, Heart, MessageCircle, CalendarDays, CreditCard, Megaphone } from "lucide-react";
import type { NotificationType } from "@/models/Notification";

export const notificationIcons: Record<NotificationType, typeof Music> = {
  new_song: Music,
  new_follower: UserPlus,
  like: Heart,
  comment: MessageCircle,
  event: CalendarDays,
  payment: CreditCard,
  system: Megaphone,
};

export const notificationLabels: Record<NotificationType, string> = {
  new_song: "Nouveau son",
  new_follower: "Nouvel abonné",
  like: "J'aime",
  comment: "Commentaire",
  event: "Évènement",
  payment: "Paiement",
  system: "Annonce",
};

/** Libellé de l'action rapide principale proposée sur la carte, par type. */
export const notificationActionLabels: Partial<Record<NotificationType, string>> = {
  new_song: "Écouter",
  new_follower: "Voir mes abonnés",
  like: "Voir le morceau",
  comment: "Répondre",
  event: "Voir l'évènement",
  payment: "Voir",
  system: "Voir",
};

/**
 * Teinte de chaque type : pastille d'icône quand aucune image n'est
 * disponible, et médaillon posé sur l'image quand il y en a une. Toutes
 * passent par les tokens de thème, donc restent lisibles en clair comme en
 * sombre — une couleur figée ne tiendrait que sur l'un des deux fonds.
 */
export const notificationTints: Record<NotificationType, { tile: string; icon: string; badge: string }> = {
  new_song: { tile: "bg-accent/10", icon: "text-accent", badge: "bg-accent" },
  new_follower: { tile: "bg-tint-blue/10", icon: "text-tint-blue", badge: "bg-tint-blue" },
  like: { tile: "bg-tint-rose/10", icon: "text-tint-rose", badge: "bg-tint-rose" },
  comment: { tile: "bg-tint-teal/10", icon: "text-tint-teal", badge: "bg-tint-teal" },
  event: { tile: "bg-tint-amber/10", icon: "text-tint-amber", badge: "bg-tint-amber" },
  payment: { tile: "bg-tint-emerald/10", icon: "text-tint-emerald", badge: "bg-tint-emerald" },
  system: { tile: "bg-tint-slate/10", icon: "text-tint-slate", badge: "bg-tint-slate" },
};
