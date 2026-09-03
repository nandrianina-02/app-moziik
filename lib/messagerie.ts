import type { LucideIcon } from "lucide-react";
import { Music2, Disc3, ListMusic, Mic2, CalendarDays, Radio, Podcast } from "lucide-react";

/**
 * Le vocabulaire de la messagerie, du côté qui n'a pas de base de données.
 *
 * CE FICHIER N'IMPORTE NI MONGOOSE NI AUCUN MODÈLE, ET C'EST VOULU
 *
 * Les bulles, la liste des conversations et le sélecteur de contenu
 * vivent dans le navigateur ; les routes d'API vivent sur le serveur. Les
 * deux ont besoin des mêmes types et des mêmes libellés. Un import de
 * modèle ici embarquerait la base entière dans le paquet client — c'est
 * la raison d'être de lib/univers.ts, lib/evenements.ts et lib/albums.ts,
 * et la même règle s'applique ici.
 */

/* ------------------------------------------------------------ contenus -- */

/**
 * Ce qui peut voyager dans un message.
 *
 * Un podcast est un album dont le type est « podcast » (lib/albums.ts) :
 * il n'a pas de modèle à lui. Il a en revanche sa propre entrée ici,
 * parce qu'annoncer « Album » sur la carte d'un épisode serait faux pour
 * qui la reçoit — et que c'est la carte, pas le schéma, que les gens
 * lisent.
 *
 * Une radio n'est pas un document non plus : c'est une station de la page
 * /radio, désignée par sa clé. Elle est partageable parce qu'elle se
 * rouvre à l'identique, ce qui est la seule chose qui compte ici.
 */
export type TypePartage = "song" | "album" | "podcast" | "playlist" | "artist" | "event" | "radio";

export const TYPES_PARTAGE: TypePartage[] = [
  "song",
  "album",
  "podcast",
  "playlist",
  "artist",
  "event",
  "radio",
];

export const LIBELLES_PARTAGE: Record<TypePartage, string> = {
  song: "Titre",
  album: "Album",
  podcast: "Podcast",
  playlist: "Playlist",
  artist: "Artiste",
  event: "Évènement",
  radio: "Radio",
};

/** Ce qu'annonce le bouton de la carte : ouvrir, écouter, s'y rendre. */
export const ACTIONS_PARTAGE: Record<TypePartage, string> = {
  song: "Écouter",
  album: "Ouvrir l'album",
  podcast: "Écouter l'épisode",
  playlist: "Ouvrir la playlist",
  artist: "Voir l'artiste",
  event: "Voir l'évènement",
  radio: "Lancer la radio",
};

export const ICONES_PARTAGE: Record<TypePartage, LucideIcon> = {
  song: Music2,
  album: Disc3,
  podcast: Podcast,
  playlist: ListMusic,
  artist: Mic2,
  event: CalendarDays,
  radio: Radio,
};

/**
 * Le contenu partagé, tel qu'il est enregistré dans le message.
 *
 * Le titre, le sous-titre et l'image sont recopiés à l'envoi plutôt que
 * relus à l'affichage. Deux raisons, et la seconde est la vraie : une
 * conversation est une archive, et un morceau retiré du catalogue ne doit
 * pas transformer un échange d'il y a six mois en carte vide. `refId`
 * reste là pour le lien, qui lui peut légitimement ne plus mener nulle
 * part.
 */
export type ContenuPartage = {
  type: TypePartage;
  /** Identifiant du document, ou clé de station pour une radio. */
  refId: string;
  titre: string;
  sousTitre?: string;
  imageUrl?: string;
  /** Chemin interne, prêt à être ouvert : `/son/<id>`, `/album/<id>`… */
  chemin: string;
};

/* -------------------------------------------------- pièces jointes -- */

/**
 * Une image ou un son joint à un message.
 *
 * Deux types, et pas davantage. Un document ou une archive n'auraient
 * rien à faire dans une messagerie musicale : ils demanderaient un
 * antivirus, une politique de rétention et un visualiseur, pour un usage
 * que personne n'a réclamé. Une photo et un mémo vocal, si.
 *
 * La durée et les dimensions sont recopiées à l'envoi : elles permettent
 * de réserver la place de la bulle avant que le fichier n'arrive, donc
 * d'éviter que le fil ne saute à chaque image qui se charge.
 */
export type TypePiece = "image" | "audio";

export type PieceJointe = {
  type: TypePiece;
  url: string;
  nom: string;
  /** Octets. Affichée pour un son, tue pour une image. */
  taille?: number;
  /** Secondes, pour l'audio. */
  duree?: number;
  largeur?: number;
  hauteur?: number;
};

/** Au-delà, ce n'est plus un message mais un envoi de fichiers. */
export const PIECES_MAX = 4;
/** 10 Mo : une photo de téléphone passe, une vidéo déguisée non. */
export const PIECE_OCTETS_MAX = 10 * 1024 * 1024;

export function libelleTaille(octets?: number): string {
  if (!octets) return "";
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

export function dureeCourte(secondes?: number): string {
  if (!secondes || !Number.isFinite(secondes)) return "";
  const m = Math.floor(secondes / 60);
  const s = Math.round(secondes % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ------------------------------------------------------------ messages -- */

/**
 * Qui parle.
 *
 * `assistant` n'est pas un membre d'un genre particulier : c'est une
 * machine, et l'interface doit pouvoir le dire à chaque bulle. Les
 * confondre coûterait ici ce que cela coûterait au support — on ne
 * saurait plus qu'on parle à un programme.
 */
export type RoleMessage = "membre" | "assistant";

/** Le nom sous lequel l'assistant s'affiche, partout et sans exception. */
export const NOM_ASSISTANT = "Assistant Moziik";

export type AuteurMessage = {
  _id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
};

/** Le message auquel celui-ci répond, réduit à ce qu'affiche l'entête. */
export type Citation = {
  messageId: string;
  auteurNom: string;
  extrait: string;
};

export type Reaction = {
  emoji: string;
  /** Identifiants des personnes ayant posé cet emoji. */
  users: string[];
};

export type MessageAffiche = {
  _id: string;
  role: RoleMessage;
  auteur: AuteurMessage | null;
  corps: string;
  partage?: ContenuPartage | null;
  pieces: PieceJointe[];
  citation?: Citation | null;
  reactions: Reaction[];
  supprime: boolean;
  modifieLe?: string | null;
  createdAt: string;
};

/* ------------------------------------------------------- conversations -- */

export type TypeConversation = "direct" | "group" | "assistant";

export type ParticipantAffiche = {
  _id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  /** Administrateur du groupe : peut renommer, ajouter, exclure. */
  gestionnaire: boolean;
  /** Dernière activité connue, pour la pastille de présence. */
  vuLe?: string | null;
};

export type ConversationAffichee = {
  _id: string;
  type: TypeConversation;
  /** Qui est en train d'écrire, en ce moment, moi excepté. */
  saisie?: { _id: string; name: string }[];
  /** Nom du groupe, ou de l'autre personne pour une conversation directe. */
  titre: string;
  imageUrl?: string | null;
  participants: ParticipantAffiche[];
  /** Pour une conversation directe : l'autre. Absent pour un groupe. */
  interlocuteur?: ParticipantAffiche | null;
  apercu: string;
  dernierMessageLe?: string | null;
  nonLus: number;
  silencieux: boolean;
  /** Vrai quand la personne connectée peut renommer ou exclure. */
  gestionnaire: boolean;
};

/* -------------------------------------------------------------- limites -- */

export const CORPS_MAX = 4000;
export const TITRE_GROUPE_MAX = 60;
/** Au-delà, ce n'est plus une conversation de groupe mais une diffusion. */
export const MEMBRES_MAX = 50;
/** Les emojis proposés d'un geste ; rien n'empêche d'en poser un autre. */
export const REACTIONS_RAPIDES = ["❤️", "🔥", "👏", "😂", "😮", "😢"];

/* -------------------------------------------------------------- présence -- */

/**
 * Fenêtre au-delà de laquelle on cesse de dire « en ligne ».
 *
 * Deux minutes, parce que la présence est déduite d'une interrogation
 * périodique et non d'une connexion maintenue : quelqu'un qui vient
 * d'envoyer un message serait annoncé absent avec une fenêtre plus
 * courte, et présent une heure après son départ avec une plus longue.
 *
 * Ce que cela mesure est donc « actif récemment », pas « connecté ». Le
 * libellé le dit — « En ligne » quand c'est frais, « Vu il y a … »
 * ensuite — plutôt que d'afficher une pastille verte sur une déduction.
 */
export const FENETRE_PRESENCE_MS = 2 * 60 * 1000;

export function estEnLigne(vuLe?: string | Date | null): boolean {
  if (!vuLe) return false;
  const t = new Date(vuLe).getTime();
  return Number.isFinite(t) && Date.now() - t < FENETRE_PRESENCE_MS;
}

/** « En ligne », « Vu il y a 12 min », « Vu le 3 septembre ». */
export function libellePresence(vuLe?: string | Date | null): string {
  if (!vuLe) return "Hors ligne";
  const date = new Date(vuLe);
  const ecart = Date.now() - date.getTime();
  if (!Number.isFinite(ecart)) return "Hors ligne";
  if (ecart < FENETRE_PRESENCE_MS) return "En ligne";

  const minutes = Math.floor(ecart / 60000);
  if (minutes < 60) return `Vu il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `Vu il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  if (jours === 1) return "Vu hier";
  if (jours < 7) return `Vu il y a ${jours} jours`;
  return `Vu le ${date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;
}

/* -------------------------------------------------------------- horaires -- */

export function heureCourte(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/** « 11:32 » aujourd'hui, « Hier », « Lun. », puis la date. */
export function horodatageListe(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const jour = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const ecartJours = Math.round((jour(new Date()) - jour(d)) / 86400000);

  if (ecartJours === 0) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (ecartJours === 1) return "Hier";
  if (ecartJours < 7) return d.toLocaleDateString("fr-FR", { weekday: "short" });
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

/** Séparateur de journée dans le fil : « Aujourd'hui », « Hier », la date. */
export function libelleJour(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const jour = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const ecart = Math.round((jour(new Date()) - jour(d)) / 86400000);
  if (ecart === 0) return "Aujourd'hui";
  if (ecart === 1) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/** Le texte qui résume un message dans la liste des conversations. */
export function apercuMessage(
  corps: string,
  partage?: ContenuPartage | null,
  pieces?: PieceJointe[] | null
): string {
  if (corps.trim()) return corps.trim().slice(0, 120);
  if (partage) return `${LIBELLES_PARTAGE[partage.type]} · ${partage.titre}`;
  const piece = pieces?.[0];
  if (piece) return piece.type === "image" ? "Photo" : "Message vocal";
  return "";
}

/**
 * Fenêtre pendant laquelle « écrit… » reste affiché après le dernier signe.
 *
 * Six secondes, contre trois pour la cadence d'envoi côté client : la
 * marge absorbe une frappe hésitante et un aller-retour lent, sans quoi
 * l'indicateur clignoterait à chaque pause entre deux mots.
 */
export const FENETRE_SAISIE_MS = 6000;

/** Initiales d'un nom, pour l'avatar de repli. */
export function initiales(nom: string): string {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0]?.toUpperCase() ?? "")
    .join("");
}
