import { connectDB } from "@/lib/db";
import Notification, { NotificationType } from "@/models/Notification";
import { envoyerPushBorne } from "@/lib/push";
import { texteBrut } from "@/lib/annonceTexte";

export async function notify({
  recipient,
  type,
  title,
  message,
  link,
  imageUrl,
  format,
}: {
  recipient: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  imageUrl?: string;
  /** « riche » : message mis en forme (annonces). */
  format?: "texte" | "riche";
}) {
  await connectDB();
  const notification = await Notification.create({ recipient, type, title, message, link, imageUrl, format });
  // Le téléphone sonne aussi (app native) ; sans configuration Firebase, rien ne part.
  await envoyerPushBorne([recipient], { type, title, message: format === "riche" ? texteBrut(message) : message, link });
  return notification;
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
  const crees = await Notification.insertMany(notifications);
  const parDestinataire = new Map(notifications.map((n) => [n.recipient, n]));
  await envoyerPushBorne([...parDestinataire.keys()], (destinataire) => {
    const n = parDestinataire.get(destinataire)!;
    return { type: n.type, title: n.title, message: n.format === "riche" ? texteBrut(n.message) : n.message, link: n.link };
  });
  return crees;
}

/** Envoie la même notification à plusieurs destinataires (ex: tous les abonnés d'un artiste). */
export async function notifyMany(
  recipients: string[],
  data: Omit<Parameters<typeof notify>[0], "recipient">
) {
  await connectDB();
  const crees = await Notification.insertMany(
    recipients.map((recipient) => ({ recipient, ...data }))
  );
  await envoyerPushBorne(recipients, {
    type: data.type,
    title: data.title,
    // La notification push n'affiche que du texte : la mise en forme d'une annonce en est retirée.
    message: data.format === "riche" ? texteBrut(data.message) : data.message,
    link: data.link,
  });
  return crees;
}
