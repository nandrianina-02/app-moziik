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
