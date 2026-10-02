/**
 * L'historique d'activité d'un compte.
 *
 * CE QU'IL EST, ET CE QU'IL N'EST PAS
 *
 * Il ne tient aucun registre à part : il relit ce que la plateforme
 * enregistre déjà, dans les collections qui portent une date et un
 * compte. C'est le choix le plus honnête, et le seul qui donne un
 * historique dès le premier jour — un journal d'évènements créé
 * aujourd'hui serait vide pour les quatre cent cinquante-huit comptes
 * existants, et ne dirait rien de ce qu'ils ont fait depuis l'ouverture.
 *
 * CE QUI MANQUE, ET POURQUOI
 *
 * Les « j'aime » et les artistes suivis ne sont PAS dans cette liste. Le
 * modèle les stocke en tableaux d'identifiants — `likedSongs`,
 * `savedAlbums`, `Artist.followers` — sans aucune date. On sait que le
 * compte aime tel titre ; on ne saura jamais quand il l'a aimé. Les faire
 * figurer supposerait d'inventer un instant, ce qu'un historique ne peut
 * pas se permettre : c'est précisément la chose qu'on vient y vérifier.
 *
 * Volontairement sans mongoose : ce fichier traverse la frontière
 * client/serveur.
 */

export type TypeActivite =
  | "ecoute"
  | "commentaire"
  | "playlist"
  | "publication"
  | "evenement"
  | "abonnement"
  | "connexion"
  | "support";

export type EntreeActivite = {
  /** Identifiant du document d'origine — unique au sein de son type. */
  _id: string;
  type: TypeActivite;
  /** Date ISO. C'est elle qui ordonne tout le fil. */
  at: string;
  /** Ce qui s'est passé, à la première personne. */
  titre: string;
  /** Précision facultative : l'artiste, l'appareil, un extrait. */
  detail?: string;
  /** Où retrouver le contenu concerné, quand il existe encore. */
  href?: string;
  coverUrl?: string;
};

export type PageActivite = {
  entrees: EntreeActivite[];
  /** Vrai s'il reste des entrées plus anciennes à demander. */
  encore: boolean;
};

/** Les filtres proposés, dans l'ordre où ils s'affichent. */
export const FILTRES_ACTIVITE: { id: TypeActivite | "tout"; label: string }[] = [
  { id: "tout", label: "Tout" },
  { id: "ecoute", label: "Écoutes" },
  { id: "commentaire", label: "Commentaires" },
  { id: "playlist", label: "Playlists" },
  { id: "publication", label: "Publications" },
  { id: "evenement", label: "Évènements" },
  { id: "abonnement", label: "Abonnement" },
  { id: "connexion", label: "Connexions" },
  { id: "support", label: "Support" },
];

export function estTypeActivite(valeur: string): valeur is TypeActivite {
  return FILTRES_ACTIVITE.some((f) => f.id === valeur && f.id !== "tout");
}

/**
 * Le jour d'une entrée, tel qu'on le titre dans le fil.
 *
 * « Aujourd'hui » et « Hier » plutôt qu'une date : c'est ainsi qu'on parle
 * des deux derniers jours, et c'est la portion du fil qu'on relit le plus.
 */
export function libelleJourActivite(iso: string, fuseau?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const jour = (date: Date) =>
    new Intl.DateTimeFormat("fr-CA", {
      timeZone: fuseau || undefined,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);

  const maintenant = new Date();
  const hier = new Date(maintenant.getTime() - 24 * 60 * 60 * 1000);

  if (jour(d) === jour(maintenant)) return "Aujourd'hui";
  if (jour(d) === jour(hier)) return "Hier";

  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: fuseau || undefined,
    weekday: "long",
    day: "numeric",
    month: "long",
    // L'année seulement si ce n'est pas la nôtre : « 3 mars » se lit mieux
    // que « 3 mars 2026 » tant qu'il n'y a pas d'ambiguïté.
    ...(d.getFullYear() === maintenant.getFullYear() ? {} : { year: "numeric" }),
  }).format(d);
}

/** L'heure seule, affichée en tête de chaque entrée. */
export function heureActivite(iso: string, fuseau?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: fuseau || undefined,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Regroupe un fil déjà trié par date décroissante, jour par jour. */
export function parJour(
  entrees: EntreeActivite[],
  fuseau?: string
): { jour: string; entrees: EntreeActivite[] }[] {
  const groupes: { jour: string; entrees: EntreeActivite[] }[] = [];
  for (const entree of entrees) {
    const jour = libelleJourActivite(entree.at, fuseau);
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.jour === jour) dernier.entrees.push(entree);
    else groupes.push({ jour, entrees: [entree] });
  }
  return groupes;
}
