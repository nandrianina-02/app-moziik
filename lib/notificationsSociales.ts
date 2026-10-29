import Notification from "@/models/Notification";
import User from "@/models/User";
import { notify, notifyMany } from "@/lib/notify";

/**
 * Les notifications des fonctions sociales : un membre vous suit, un
 * collaborateur rejoint votre playlist ou y ajoute des titres.
 *
 * Chacune est bornée dans le temps. Suivre, ne plus suivre puis suivre de
 * nouveau ne doit pas prévenir trois fois ; ajouter dix titres d'affilée à
 * une playlist commune non plus. On ne prévient donc pas deux fois la même
 * personne pour le même lien dans la fenêtre donnée.
 *
 * Aucune de ces fonctions ne fait échouer l'action qui la déclenche : une
 * notification perdue vaut mieux qu'un abonnement refusé.
 */

const JOUR_MS = 24 * 3600 * 1000;
const DEMI_HEURE_MS = 30 * 60 * 1000;

async function dejaPrevenus(destinataires: string[], link: string, fenetreMs: number): Promise<Set<string>> {
  const recents = await Notification.find({
    recipient: { $in: destinataires },
    link,
    createdAt: { $gte: new Date(Date.now() - fenetreMs) },
  })
    .select("recipient")
    .lean();
  return new Set(recents.map((n) => String(n.recipient)));
}

/** `suiveurId` vient de suivre `cibleId`. Si le suivi devient mutuel, la notification annonce le Blend. */
export async function prevenirNouvelAbonne(suiveurId: string, cibleId: string) {
  try {
    const [suiveur, cible] = await Promise.all([
      User.findById(suiveurId).select("name username avatarUrl").lean(),
      User.findById(cibleId).select("abonnementsMembres").lean(),
    ]);
    if (!suiveur?.username || !cible) return;
    const mutuel = (cible.abonnementsMembres ?? []).some((id) => String(id) === suiveurId);
    const link = mutuel ? `/blend/${suiveur.username}` : `/membre/${suiveur.username}`;
    if ((await dejaPrevenus([cibleId], link, JOUR_MS)).size > 0) return;
    await notify({
      recipient: cibleId,
      type: "new_follower",
      title: mutuel ? `${suiveur.name} vous suit en retour` : `${suiveur.name} vous suit`,
      message: mutuel
        ? "Vous vous suivez mutuellement : votre Blend est prêt."
        : "Suivez ce membre en retour pour voir ce qu'il écoute et faire un Blend.",
      link,
      imageUrl: suiveur.avatarUrl,
    });
  } catch (err) {
    console.error("[notifications] nouvel abonné", err);
  }
}

type PlaylistCommune = { _id: unknown; title: string; coverUrl?: string; owner: unknown; collaborateurs: unknown[] };

/** Un membre vient de rejoindre la playlist collaborative : son propriétaire est prévenu. */
export async function prevenirArriveeCollaborateur(playlist: PlaylistCommune, collaborateurId: string) {
  try {
    const membre = await User.findById(collaborateurId).select("name avatarUrl").lean();
    await notify({
      recipient: String(playlist.owner),
      type: "playlist",
      title: `${membre?.name ?? "Un membre"} a rejoint « ${playlist.title} »`,
      message: "Il peut désormais ajouter et retirer des titres dans cette playlist.",
      link: `/playlist/${String(playlist._id)}`,
      imageUrl: membre?.avatarUrl ?? playlist.coverUrl,
    });
  } catch (err) {
    console.error("[notifications] arrivée d'un collaborateur", err);
  }
}

/**
 * Des titres ont été ajoutés à une playlist collaborative : les autres
 * participants (propriétaire et collaborateurs, sauf l'auteur) sont
 * prévenus, au plus une fois par demi-heure et par playlist.
 */
export async function prevenirAjoutTitres(playlist: PlaylistCommune, auteurId: string, nombre: number) {
  try {
    const participants = [String(playlist.owner), ...playlist.collaborateurs.map(String)];
    const destinataires = [...new Set(participants)].filter((id) => id !== auteurId);
    if (destinataires.length === 0) return;
    const link = `/playlist/${String(playlist._id)}`;
    const deja = await dejaPrevenus(destinataires, link, DEMI_HEURE_MS);
    const aPrevenir = destinataires.filter((id) => !deja.has(id));
    if (aPrevenir.length === 0) return;
    const auteur = await User.findById(auteurId).select("name").lean();
    await notifyMany(aPrevenir, {
      type: "playlist",
      title: `Du nouveau dans « ${playlist.title} »`,
      message: `${auteur?.name ?? "Un collaborateur"} a ajouté ${nombre} titre${nombre > 1 ? "s" : ""}.`,
      link,
      imageUrl: playlist.coverUrl,
    });
  } catch (err) {
    console.error("[notifications] ajout de titres", err);
  }
}
