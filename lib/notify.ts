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
