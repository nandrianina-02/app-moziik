import User from "@/models/User";
import { notifyMany } from "@/lib/notify";
import { extraireMentions } from "@/lib/mentions";

/** Au-delà, c'est un envoi en masse déguisé en commentaire. */
const MENTIONS_MAX = 5;

/**
 * Prévient les personnes citées par leur nom d'utilisateur dans un texte.
 *
 * Trois garde-fous, tous pour la même raison — une mention doit rester une
 * marque d'attention, pas un canal d'envoi : jamais soi-même, jamais
 * quelqu'un déjà prévenu par ailleurs (l'artiste du morceau reçoit déjà sa
 * notification de commentaire), et cinq destinataires au plus, quel que
 * soit le nombre d'arobases dans le texte.
 */
export async function notifierMentions({
  texte,
  auteurId,
  dejaPrevenu = [],
  lien,
  titre,
  avatarUrl,
}: {
  texte: string;
  auteurId: string;
  /** Identifiants d'utilisateurs déjà notifiés pour cet évènement. */
  dejaPrevenu?: (string | undefined | null)[];
  lien: string;
  titre: string;
  avatarUrl?: string;
}): Promise<number> {
  const noms = extraireMentions(texte);
  if (noms.length === 0) return 0;

  const exclus = new Set([auteurId, ...dejaPrevenu.filter(Boolean).map(String)]);
  const cites = await User.find({ username: { $in: noms.slice(0, 20) }, suspended: { $ne: true } })
    .select("_id")
    .limit(MENTIONS_MAX + exclus.size)
    .lean();

  const destinataires = cites
    .map((u) => u._id.toString())
    .filter((id) => !exclus.has(id))
    .slice(0, MENTIONS_MAX);

  if (destinataires.length === 0) return 0;

  const extrait = texte.length > 120 ? `${texte.slice(0, 120)}…` : texte;
  await notifyMany(destinataires, {
    type: "comment",
    title: titre,
    message: extrait,
    link: lien,
    imageUrl: avatarUrl,
  });

  return destinataires.length;
}
