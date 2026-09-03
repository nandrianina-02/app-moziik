import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Song from "@/models/Song";
import Album from "@/models/Album";
import Playlist from "@/models/Playlist";
import Artist from "@/models/Artist";
import Event from "@/models/Event";
import Conversation, { type IConversation, type IParticipant } from "@/models/Conversation";
import Message, { type IMessage } from "@/models/Message";
import { ApiError } from "@/lib/apiError";
import { estPodcast } from "@/lib/albums";
import { resoudreStation, cheminStation } from "@/lib/radios";
import {
  apercuMessage,
  type ContenuPartage,
  type ConversationAffichee,
  type MessageAffiche,
  type ParticipantAffiche,
  type TypePartage,
} from "@/lib/messagerie";

/**
 * Le travail de la messagerie qui a besoin de la base.
 *
 * Séparé de lib/messagerie.ts, qui ne connaît que des types et des
 * libellés et part donc dans le navigateur. Ici on lit des documents, on
 * vérifie des droits, et on transforme des documents en objets d'affichage.
 */

/* ------------------------------------------------------------- présence -- */

/**
 * Note que quelqu'un est là, sans attendre que ce soit écrit.
 *
 * Appelée à chaque interrogation de la messagerie, soit toutes les
 * quelques secondes par personne connectée. Attendre l'écriture
 * ajouterait un aller-retour à une réponse dont personne n'a besoin
 * qu'elle soit à jour à la milliseconde ; échouer sur elle serait pire
 * encore, puisqu'une pastille de présence ferait alors échouer la lecture
 * des messages.
 */
export function toucherPresence(userId: string): void {
  void User.updateOne({ _id: userId }, { $set: { lastSeenAt: new Date() } }).catch(() => {
    /* la présence n'est pas une donnée dont l'échec doive se voir */
  });
}

/* ---------------------------------------------------------------- accès -- */

type ConversationDoc = IConversation & { _id: Types.ObjectId };

/** Le participant que je suis, ou rien si je n'ai jamais été de la conversation. */
export function moiDans(conv: IConversation, userId: string): IParticipant | undefined {
  return conv.participants.find((p) => String(p.user) === String(userId));
}

export function membreActif(conv: IConversation, userId: string): boolean {
  const moi = moiDans(conv, userId);
  return Boolean(moi && !moi.leftAt);
}

/**
 * Charge une conversation dont je fais partie, ou refuse.
 *
 * « Introuvable » et « pas à moi » renvoient tous deux 404, et c'est
 * délibéré : distinguer les deux dirait à un inconnu qu'une conversation
 * existe à cet identifiant.
 */
export async function conversationOuvree(id: string, userId: string): Promise<ConversationDoc> {
  if (!Types.ObjectId.isValid(id)) throw new ApiError("Conversation introuvable.", 404);
  await connectDB();
  const conv = await Conversation.findById(id);
  if (!conv || !moiDans(conv, userId)) throw new ApiError("Conversation introuvable.", 404);
  return conv as unknown as ConversationDoc;
}

/** Comme ci-dessus, mais refuse aussi à qui a quitté le groupe. */
export async function conversationActive(id: string, userId: string): Promise<ConversationDoc> {
  const conv = await conversationOuvree(id, userId);
  if (!membreActif(conv, userId)) {
    throw new ApiError("Vous avez quitté cette conversation.", 403);
  }
  return conv;
}

/* ------------------------------------------------------------- contenus -- */

type Brut = Record<string, unknown>;

const texte = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/**
 * Un contenu sans nom ne se partage pas.
 *
 * La base porte encore quelques documents d'un schéma antérieur, dont les
 * champs s'appellent autrement — un album y a un `titre`, pas un `title`.
 * Lus par le code d'aujourd'hui, ils n'ont pas de titre du tout. Un repli
 * générique en produirait une carte annonçant « Album », sans rien dire de
 * plus : mieux vaut refuser l'envoi et le dire, que de laisser partir une
 * carte que personne ne pourra identifier.
 */
function siNomme(carte: ContenuPartage | null): ContenuPartage | null {
  return carte && carte.titre.trim() ? carte : null;
}

/**
 * Fabrique la carte d'un contenu à partir de son type et de son
 * identifiant, en lisant la base.
 *
 * Rien n'est fabriqué à partir de ce que le client envoie : le titre,
 * l'image et le chemin sont relus ici. Faire confiance au navigateur
 * permettrait d'envoyer une carte qui annonce un morceau et pointe
 * ailleurs — une carte de partage est un lien déguisé en objet reconnu,
 * c'est exactement le format d'un hameçonnage réussi.
 *
 * Renvoie `null` quand le contenu n'existe pas ou n'est pas visible :
 * l'appel refuse alors l'envoi plutôt que de coller une carte vide.
 */
export async function resoudrePartage(
  type: TypePartage,
  refId: string,
  demandeur: string
): Promise<ContenuPartage | null> {
  await connectDB();

  // La radio est la seule qui ne soit pas un document : sa clé se résout
  // dans la liste des stations, sans base.
  if (type === "radio") {
    const station = resoudreStation(refId);
    if (!station) return null;
    return {
      type: "radio",
      refId: station.cle,
      titre: station.label,
      sousTitre: station.description,
      chemin: cheminStation(station.cle),
    };
  }

  if (!Types.ObjectId.isValid(refId)) return null;

  if (type === "song") {
    const song = (await Song.findById(refId)
      .select("title coverUrl artist status")
      .populate("artist", "stageName")
      .lean()) as Brut | null;
    if (!song || song.status !== "published") return null;
    const artiste = song.artist as Brut | null;
    return siNomme({
      type: "song",
      refId,
      titre: texte(song.title) ?? "",
      sousTitre: texte(artiste?.stageName),
      imageUrl: texte(song.coverUrl),
      chemin: `/son/${refId}`,
    });
  }

  if (type === "album" || type === "podcast") {
    const album = (await Album.findById(refId)
      .select("title coverUrl type artist songs")
      .populate("artist", "stageName")
      .lean()) as Brut | null;
    if (!album) return null;
    const artiste = album.artist as Brut | null;
    const pistes = Array.isArray(album.songs) ? album.songs.length : 0;
    // Le type réel prime sur celui que le client annonce : un épisode
    // envoyé comme « album » reste un podcast sur la carte.
    const reel: TypePartage = estPodcast(texte(album.type)) ? "podcast" : "album";
    return siNomme({
      type: reel,
      refId,
      titre: texte(album.title) ?? "",
      sousTitre: [texte(artiste?.stageName), pistes ? `${pistes} piste${pistes > 1 ? "s" : ""}` : null]
        .filter(Boolean)
        .join(" · "),
      imageUrl: texte(album.coverUrl),
      chemin: `/album/${refId}`,
    });
  }

  if (type === "playlist") {
    const playlist = (await Playlist.findById(refId)
      .select("title coverUrl isPublic owner songs")
      .lean()) as Brut | null;
    if (!playlist) return null;
    // Une playlist privée ne s'envoie pas : la personne qui la recevrait
    // cliquerait sur une carte qui lui serait refusée.
    if (!playlist.isPublic && String(playlist.owner) !== String(demandeur)) return null;
    const pistes = Array.isArray(playlist.songs) ? playlist.songs.length : 0;
    return siNomme({
      type: "playlist",
      refId,
      titre: texte(playlist.title) ?? "",
      sousTitre: `${pistes} titre${pistes > 1 ? "s" : ""}`,
      imageUrl: texte(playlist.coverUrl),
      chemin: `/playlist/${refId}`,
    });
  }

  if (type === "artist") {
    const artiste = (await Artist.findById(refId).select("stageName coverUrl genres").lean()) as Brut | null;
    if (!artiste) return null;
    const genres = Array.isArray(artiste.genres) ? (artiste.genres as string[]) : [];
    return siNomme({
      type: "artist",
      refId,
      titre: texte(artiste.stageName) ?? "",
      sousTitre: genres.slice(0, 2).join(" · ") || undefined,
      imageUrl: texte(artiste.coverUrl),
      chemin: `/artiste/${refId}`,
    });
  }

  const evenement = (await Event.findById(refId)
    .select("title coverUrl date location status")
    .lean()) as Brut | null;
  if (!evenement) return null;
  const quand = evenement.date
    ? new Date(String(evenement.date)).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })
    : null;
  return siNomme({
    type: "event",
    refId,
    titre: texte(evenement.title) ?? "",
    sousTitre: [quand, texte(evenement.location)].filter(Boolean).join(" · ") || undefined,
    imageUrl: texte(evenement.coverUrl),
    chemin: `/evenements/${refId}`,
  });
}

/* --------------------------------------------------------- présentation -- */

export type FicheUtilisateur = {
  _id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  lastSeenAt?: Date | null;
};

/** Les comptes cités par un lot de conversations, en une seule requête. */
export async function fichesUtilisateurs(ids: (Types.ObjectId | string)[]): Promise<Map<string, FicheUtilisateur>> {
  const uniques = [...new Set(ids.map(String))].filter((id) => Types.ObjectId.isValid(id));
  if (uniques.length === 0) return new Map();

  const comptes = (await User.find({ _id: { $in: uniques } })
    .select("name username avatarUrl lastSeenAt")
    .lean()) as unknown as Brut[];

  return new Map(
    comptes.map((c) => [
      String(c._id),
      {
        _id: String(c._id),
        name: String(c.name ?? "Membre"),
        username: texte(c.username),
        avatarUrl: texte(c.avatarUrl),
        lastSeenAt: (c.lastSeenAt as Date) ?? null,
      },
    ])
  );
}

function participantAffiche(p: IParticipant, fiche?: FicheUtilisateur): ParticipantAffiche {
  return {
    _id: String(p.user),
    name: fiche?.name ?? "Compte supprimé",
    username: fiche?.username,
    avatarUrl: fiche?.avatarUrl,
    gestionnaire: Boolean(p.manager),
    vuLe: fiche?.lastSeenAt ? new Date(fiche.lastSeenAt).toISOString() : null,
  };
}

/**
 * Une conversation vue par l'un de ses participants.
 *
 * Le titre d'un tête-à-tête n'est pas stocké : c'est le nom de l'autre,
 * et il doit suivre les changements de nom. Le stocker figerait un
 * pseudonyme abandonné dans la liste de tout le monde.
 */
export function presenterConversation(
  conv: IConversation & { _id: Types.ObjectId },
  moi: string,
  fiches: Map<string, FicheUtilisateur>
): ConversationAffichee {
  const participants = conv.participants
    .filter((p) => !p.leftAt)
    .map((p) => participantAffiche(p, fiches.get(String(p.user))));

  const monEntree = moiDans(conv, moi);
  const autre = conv.type === "direct" ? participants.find((p) => p._id !== String(moi)) ?? null : null;

  return {
    _id: String(conv._id),
    type: conv.type,
    titre: conv.type === "group" ? conv.title || "Groupe" : autre?.name ?? "Conversation",
    imageUrl: conv.type === "group" ? conv.coverUrl ?? null : autre?.avatarUrl ?? null,
    participants,
    interlocuteur: autre,
    apercu: conv.lastMessagePreview ?? "",
    dernierMessageLe: conv.lastMessageAt ? new Date(conv.lastMessageAt).toISOString() : null,
    nonLus: monEntree?.unread ?? 0,
    silencieux: Boolean(monEntree?.muted),
    gestionnaire: conv.type === "group" ? Boolean(monEntree?.manager) : true,
  };
}

/**
 * Un message prêt à afficher.
 *
 * Les réactions sont regroupées par emoji plutôt que rendues une par
 * une : c'est « ❤️ 3 » qu'on lit sous une bulle, pas trois cœurs alignés,
 * et le client a besoin de la liste des auteurs pour savoir si le sien y
 * figure déjà.
 */
export function presenterMessage(
  doc: IMessage & { _id: Types.ObjectId },
  fiches: Map<string, FicheUtilisateur>
): MessageAffiche {
  const fiche = fiches.get(String(doc.author));
  const supprime = Boolean(doc.deletedAt);

  const groupes = new Map<string, string[]>();
  for (const r of doc.reactions ?? []) {
    const liste = groupes.get(r.emoji);
    if (liste) liste.push(String(r.user));
    else groupes.set(r.emoji, [String(r.user)]);
  }

  return {
    _id: String(doc._id),
    auteur: fiche
      ? { _id: fiche._id, name: fiche.name, username: fiche.username, avatarUrl: fiche.avatarUrl }
      : { _id: String(doc.author), name: "Compte supprimé" },
    corps: supprime ? "" : doc.body ?? "",
    partage: supprime ? null : doc.partage ?? null,
    citation: doc.citation
      ? {
          messageId: String(doc.citation.messageId),
          auteurNom: doc.citation.auteurNom,
          extrait: doc.citation.extrait,
        }
      : null,
    reactions: [...groupes.entries()].map(([emoji, users]) => ({ emoji, users })),
    supprime,
    modifieLe: doc.editedAt ? new Date(doc.editedAt).toISOString() : null,
    createdAt: new Date(doc.createdAt).toISOString(),
  };
}

/* --------------------------------------------------------------- envoi -- */

/**
 * Enregistre un message et met la conversation à jour, d'un bloc.
 *
 * L'aperçu, la date du dernier message et les compteurs de non-lus des
 * autres participants sont écrits ici et nulle part ailleurs : les
 * répartir entre les appelants garantirait qu'un chemin les oublie, et
 * une liste de conversations qui n'annonce pas le message qu'on vient de
 * recevoir est un défaut qu'on ne remarque que trop tard.
 */
export async function enregistrerMessage(
  conv: ConversationDoc,
  auteur: string,
  contenu: { corps: string; partage?: ContenuPartage | null; citation?: IMessage["citation"] }
) {
  const message = await Message.create({
    conversation: conv._id,
    author: auteur,
    body: contenu.corps,
    ...(contenu.partage ? { partage: contenu.partage } : {}),
    ...(contenu.citation ? { citation: contenu.citation } : {}),
  });

  const apercu = apercuMessage(contenu.corps, contenu.partage);
  await Conversation.updateOne(
    { _id: conv._id },
    {
      $set: {
        lastMessageAt: message.createdAt,
        lastMessagePreview: apercu,
        lastMessageFrom: new Types.ObjectId(auteur),
        // Écrire son propre message vaut lecture : sans cette ligne,
        // l'expéditeur verrait sa propre conversation en gras.
        "participants.$[moi].lastReadAt": message.createdAt,
        "participants.$[moi].unread": 0,
      },
      $inc: { "participants.$[autres].unread": 1 },
    },
    {
      arrayFilters: [
        { "moi.user": new Types.ObjectId(auteur) },
        { "autres.user": { $ne: new Types.ObjectId(auteur) }, "autres.leftAt": { $exists: false } },
      ],
    }
  );

  return message;
}
