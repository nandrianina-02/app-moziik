import type { Types } from "mongoose";
import Play from "@/models/Play";
import Comment from "@/models/Comment";
import Playlist from "@/models/Playlist";
import Song from "@/models/Song";
import Event from "@/models/Event";
import Subscription from "@/models/Subscription";
import RefreshToken from "@/models/RefreshToken";
import SupportThread from "@/models/SupportThread";
import type { EntreeActivite, PageActivite, TypeActivite } from "@/lib/activite";

/**
 * Reconstitue le fil d'activité d'un compte à partir de ce qui est déjà
 * enregistré (voir lib/activite.ts pour le parti pris).
 *
 * COMMENT LA PAGINATION TIENT SUR HUIT SOURCES
 *
 * Chaque source rend ses `limite` entrées les plus récentes antérieures au
 * curseur. On fusionne, on trie, on coupe à `limite`. La date de la
 * dernière entrée retenue devient le curseur suivant : comme toutes les
 * sources sont bornées par ce même curseur, aucune entrée ne peut être
 * sautée, et aucune ne revient deux fois.
 *
 * Un décalage de page est donc impossible, contrairement à un `skip` qui
 * se décalerait dès qu'une écoute s'ajoute pendant la lecture.
 */

/** Lot demandé à chaque source. Au-delà, on coupe de toute façon. */
const PAR_PAGE_MAX = 60;

type Options = {
  /** N'inclure que ce qui précède strictement cette date. */
  avant?: Date;
  /** Restreint à un seul type ; absent, toutes les sources sont lues. */
  type?: TypeActivite;
  limite?: number;
};

/** Le filtre temporel commun, sur le champ que porte la collection. */
function borne(champ: string, avant?: Date): Record<string, unknown> {
  return avant ? { [champ]: { $lt: avant } } : {};
}

function texte(valeur: unknown, repli: string): string {
  const v = typeof valeur === "string" ? valeur.trim() : "";
  return v || repli;
}

/** Coupe un extrait sans couper un mot en deux. */
function extrait(valeur: unknown, max = 90): string | undefined {
  const v = typeof valeur === "string" ? valeur.trim().replace(/\s+/g, " ") : "";
  if (!v) return undefined;
  if (v.length <= max) return v;
  const coupe = v.slice(0, max);
  const espace = coupe.lastIndexOf(" ");
  return `${espace > max * 0.6 ? coupe.slice(0, espace) : coupe}…`;
}

type Doc = Record<string, unknown>;

/** Le titre populé d'une référence, ou null si le contenu a disparu. */
function reference(valeur: unknown): Doc | null {
  return valeur && typeof valeur === "object" ? (valeur as Doc) : null;
}

async function ecoutes(user: string, o: Options, limite: number): Promise<EntreeActivite[]> {
  const docs = await Play.find({ user, ...borne("playedAt", o.avant) })
    .select("song playedAt")
    .populate("song", "title coverUrl artist")
    .populate({ path: "song", populate: { path: "artist", select: "stageName" } })
    .sort({ playedAt: -1 })
    .limit(limite)
    .lean();

  return docs.map((d) => {
    const song = reference((d as Doc).song);
    const artiste = song ? reference(song.artist) : null;
    return {
      _id: String((d as Doc)._id),
      type: "ecoute" as const,
      at: new Date((d as Doc).playedAt as Date).toISOString(),
      // Un titre supprimé depuis laisse sa trace : l'écoute a eu lieu, et
      // la masquer trouerait le fil sans l'expliquer.
      titre: `Écoute de « ${texte(song?.title, "titre supprimé")} »`,
      detail: artiste ? texte(artiste.stageName, "") || undefined : undefined,
      href: song ? `/son/${String(song._id)}` : undefined,
      coverUrl: song ? (song.coverUrl as string | undefined) : undefined,
    };
  });
}

async function commentaires(user: string, o: Options, limite: number): Promise<EntreeActivite[]> {
  const docs = await Comment.find({ user, ...borne("createdAt", o.avant) })
    .select("song text createdAt")
    .populate("song", "title coverUrl")
    .sort({ createdAt: -1 })
    .limit(limite)
    .lean();

  return docs.map((d) => {
    const song = reference((d as Doc).song);
    return {
      _id: String((d as Doc)._id),
      type: "commentaire" as const,
      at: new Date((d as Doc).createdAt as Date).toISOString(),
      titre: `Commentaire sur « ${texte(song?.title, "titre supprimé")} »`,
      detail: extrait((d as Doc).text),
      href: song ? `/son/${String(song._id)}` : undefined,
      coverUrl: song ? (song.coverUrl as string | undefined) : undefined,
    };
  });
}

async function playlists(user: string, o: Options, limite: number): Promise<EntreeActivite[]> {
  const docs = await Playlist.find({ owner: user, ...borne("createdAt", o.avant) })
    .select("title coverUrl songs createdAt")
    .sort({ createdAt: -1 })
    .limit(limite)
    .lean();

  return docs.map((d) => {
    const nb = Array.isArray((d as Doc).songs) ? ((d as Doc).songs as unknown[]).length : 0;
    return {
      _id: String((d as Doc)._id),
      type: "playlist" as const,
      at: new Date((d as Doc).createdAt as Date).toISOString(),
      titre: `Playlist « ${texte((d as Doc).title, "sans titre")} » créée`,
      detail: nb > 0 ? `${nb} titre${nb > 1 ? "s" : ""} aujourd'hui` : undefined,
      href: `/playlist/${String((d as Doc)._id)}`,
      coverUrl: (d as Doc).coverUrl as string | undefined,
    };
  });
}

async function publications(user: string, o: Options, limite: number): Promise<EntreeActivite[]> {
  const docs = await Song.find({ publishedBy: user, ...borne("createdAt", o.avant) })
    .select("title coverUrl status createdAt")
    .sort({ createdAt: -1 })
    .limit(limite)
    .lean();

  return docs.map((d) => ({
    _id: String((d as Doc)._id),
    type: "publication" as const,
    at: new Date((d as Doc).createdAt as Date).toISOString(),
    titre: `Titre « ${texte((d as Doc).title, "sans titre")} » déposé`,
    detail: (d as Doc).status === "published" ? "En ligne" : "Pas encore publié",
    href: `/son/${String((d as Doc)._id)}`,
    coverUrl: (d as Doc).coverUrl as string | undefined,
  }));
}

async function evenements(user: string, o: Options, limite: number): Promise<EntreeActivite[]> {
  const docs = await Event.find({ createdBy: user, ...borne("createdAt", o.avant) })
    .select("title coverUrl location createdAt")
    .sort({ createdAt: -1 })
    .limit(limite)
    .lean();

  return docs.map((d) => ({
    _id: String((d as Doc)._id),
    type: "evenement" as const,
    at: new Date((d as Doc).createdAt as Date).toISOString(),
    titre: `Évènement « ${texte((d as Doc).title, "sans titre")} » créé`,
    detail: texte((d as Doc).location, "") || undefined,
    href: `/evenements/${String((d as Doc)._id)}`,
    coverUrl: (d as Doc).coverUrl as string | undefined,
  }));
}

async function abonnements(user: string, o: Options, limite: number): Promise<EntreeActivite[]> {
  const docs = await Subscription.find({ user, ...borne("startedAt", o.avant) })
    .select("plan status startedAt")
    .sort({ startedAt: -1 })
    .limit(limite)
    .lean();

  return docs.map((d) => ({
    _id: String((d as Doc)._id),
    type: "abonnement" as const,
    at: new Date((d as Doc).startedAt as Date).toISOString(),
    titre: "Abonnement Premium souscrit",
    detail: texte((d as Doc).status, "") || undefined,
  }));
}

async function connexions(user: string, o: Options, limite: number): Promise<EntreeActivite[]> {
  // Seules les sessions de l'application laissent une trace datée : le
  // site s'appuie sur des JWT sans état, qui n'existent nulle part en
  // base (voir app/api/me/sessions/route.ts).
  const docs = await RefreshToken.find({ user, ...borne("createdAt", o.avant) })
    .select("device createdAt revoked")
    .sort({ createdAt: -1 })
    .limit(limite)
    .lean();

  return docs.map((d) => ({
    _id: String((d as Doc)._id),
    type: "connexion" as const,
    at: new Date((d as Doc).createdAt as Date).toISOString(),
    titre: "Connexion depuis l'application",
    detail: texte((d as Doc).device, "appareil inconnu"),
  }));
}

async function support(user: string, o: Options, limite: number): Promise<EntreeActivite[]> {
  const docs = await SupportThread.find({ user, ...borne("createdAt", o.avant) })
    .select("lastMessagePreview status createdAt")
    .sort({ createdAt: -1 })
    .limit(limite)
    .lean();

  return docs.map((d) => ({
    _id: String((d as Doc)._id),
    type: "support" as const,
    at: new Date((d as Doc).createdAt as Date).toISOString(),
    titre: "Conversation ouverte avec le support",
    detail: extrait((d as Doc).lastMessagePreview),
  }));
}

const SOURCES: Record<
  TypeActivite,
  (user: string, o: Options, limite: number) => Promise<EntreeActivite[]>
> = {
  ecoute: ecoutes,
  commentaire: commentaires,
  playlist: playlists,
  publication: publications,
  evenement: evenements,
  abonnement: abonnements,
  connexion: connexions,
  support,
};

export async function activiteDuCompte(
  userId: string | Types.ObjectId,
  options: Options = {}
): Promise<PageActivite> {
  const user = String(userId);
  const limite = Math.min(Math.max(options.limite ?? 30, 1), PAR_PAGE_MAX);

  const choisies = options.type ? [SOURCES[options.type]] : Object.values(SOURCES);

  // En parallèle, et chacune tolérante : une collection absente ou une
  // requête en échec ne doit pas vider tout l'historique. Mieux vaut un
  // fil incomplet qu'un écran d'erreur sur une page de consultation.
  const lots = await Promise.all(
    choisies.map((lire) =>
      lire(user, options, limite).catch(() => [] as EntreeActivite[])
    )
  );

  const tout = lots
    .flat()
    .filter((e) => !Number.isNaN(Date.parse(e.at)))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  // On demande `limite` à chaque source : s'il en revient davantage, c'est
  // qu'au moins une a encore de quoi servir au tour suivant.
  return { entrees: tout.slice(0, limite), encore: tout.length > limite };
}
