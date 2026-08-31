import { Types } from "mongoose";
import Song from "@/models/Song";
import Album from "@/models/Album";
import Playlist from "@/models/Playlist";
import EventModel from "@/models/Event";
import Artist from "@/models/Artist";

type Visualisable = { link?: string | null; imageUrl?: string | null };
type Couverture = { _id: Types.ObjectId; coverUrl?: string };

/**
 * Une notification porte l'image de ce dont elle parle (pochette, photo de
 * profil) dans `imageUrl`, renseignée à la création. Deux cas la laissent
 * pourtant vide : les notifications écrites avant que le champ n'existe, et
 * celles dont l'émetteur n'avait pas l'entité sous la main.
 *
 * Plutôt qu'une migration ponctuelle — qui ne dirait rien des prochaines —
 * on retrouve l'image à la lecture, à partir du lien : c'est lui qui
 * désigne déjà l'objet concerné. Une requête par famille d'objets et par
 * page de vingt, jamais une par notification.
 *
 * Chaque famille garde sa propre fonction de lecture : passer les modèles
 * eux-mêmes dans un tableau les réunirait en un type union dont Mongoose ne
 * sait plus quelle signature de `find` appliquer.
 */
const sources: { pattern: RegExp; couvertures: (ids: string[]) => Promise<Couverture[]> }[] = [
  {
    pattern: /^\/son\/([^/?#]+)/,
    couvertures: async (ids) => Song.find({ _id: { $in: ids } }).select("coverUrl").lean<Couverture[]>(),
  },
  {
    pattern: /^\/album\/([^/?#]+)/,
    couvertures: async (ids) => Album.find({ _id: { $in: ids } }).select("coverUrl").lean<Couverture[]>(),
  },
  {
    pattern: /^\/playlist\/([^/?#]+)/,
    couvertures: async (ids) => Playlist.find({ _id: { $in: ids } }).select("coverUrl").lean<Couverture[]>(),
  },
  {
    pattern: /^\/evenements\/([^/?#]+)/,
    couvertures: async (ids) => EventModel.find({ _id: { $in: ids } }).select("coverUrl").lean<Couverture[]>(),
  },
  {
    // Les liens d'espace personnel (/artiste/gestion, /artiste/revenus)
    // passent aussi par ce motif : ils sont écartés par isValid, qui ne
    // reconnaît que les identifiants Mongo.
    pattern: /^\/artiste\/([^/?#]+)/,
    couvertures: async (ids) => Artist.find({ _id: { $in: ids } }).select("coverUrl").lean<Couverture[]>(),
  },
];

/** Identifiant Mongo désigné par le lien, pour la famille d'objets donnée. */
function idFromLink(link: string, pattern: RegExp) {
  const id = link.match(pattern)?.[1];
  return id && Types.ObjectId.isValid(id) ? id : undefined;
}

export async function attachVisuals<T extends Visualisable>(notifications: T[]): Promise<T[]> {
  const orphelines = notifications.filter((n) => !n.imageUrl && n.link);
  if (orphelines.length === 0) return notifications;

  const couvertures = new Map<string, string>(); // identifiant -> image

  await Promise.all(
    sources.map(async ({ pattern, couvertures: lire }) => {
      const ids = new Set<string>();
      for (const n of orphelines) {
        const id = idFromLink(n.link as string, pattern);
        if (id) ids.add(id);
      }
      if (ids.size === 0) return;

      for (const doc of await lire([...ids])) {
        if (doc.coverUrl) couvertures.set(doc._id.toString(), doc.coverUrl);
      }
    })
  );

  if (couvertures.size === 0) return notifications;

  return notifications.map((n) => {
    if (n.imageUrl || !n.link) return n;
    for (const { pattern } of sources) {
      const id = idFromLink(n.link, pattern);
      const image = id && couvertures.get(id);
      if (image) return { ...n, imageUrl: image };
    }
    return n;
  });
}
