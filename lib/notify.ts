import { connectDB } from "@/lib/db";
import Notification, { NotificationType } from "@/models/Notification";

export async function notify({
  recipient,
  type,
  title,
  message,
  link,
  imageUrl,
}: {
  recipient: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  imageUrl?: string;
}) {
  await connectDB();
  return Notification.create({ recipient, type, title, message, link, imageUrl });
}

/**
 * Envoie des notifications toutes différentes, en une seule écriture.
 *
 * `notifyMany` sert quand le message est le même pour tout le monde ;
 * celle-ci quand il diffère — un relevé de droits porte le montant propre
 * à chaque artiste. Les écrire une par une revenait à un aller-retour par
 * destinataire.
 */
export async function notifyEach(
  notifications: Parameters<typeof notify>[0][]
) {
  if (notifications.length === 0) return [];
  await connectDB();
  return Notification.insertMany(notifications);
}

/** Envoie la même notification à plusieurs destinataires (ex: tous les abonnés d'un artiste). */
export async function notifyMany(
  recipients: string[],
  data: Omit<Parameters<typeof notify>[0], "recipient">
) {
  await connectDB();
  return Notification.insertMany(
    recipients.map((recipient) => ({ recipient, ...data }))
  );
}
