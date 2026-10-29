import { Types } from "mongoose";
import Play from "@/models/Play";
import Song from "@/models/Song";
import User from "@/models/User";
import { correspondance, melangerBlend } from "@/lib/blendCalcul";

/** Les goûts d'un membre se lisent sur ses six derniers mois d'écoute. */
const FENETRE_MS = 180 * 24 * 3600 * 1000;
const TITRES_PAR_MEMBRE = 60;

export class BlendRefuse extends Error {}

/** Les titres les plus écoutés d'un membre, complétés par ses titres aimés. */
async function favoris(userId: Types.ObjectId, aimes: Types.ObjectId[]): Promise<string[]> {
  const ecoutes: { _id: Types.ObjectId }[] = await Play.aggregate([
    { $match: { user: userId, playedAt: { $gte: new Date(Date.now() - FENETRE_MS) } } },
    { $group: { _id: "$song", n: { $sum: 1 } } },
    { $sort: { n: -1 } },
    { $limit: TITRES_PAR_MEMBRE },
  ]);
  const ids = ecoutes.map((e) => String(e._id));
  const vus = new Set(ids);
  for (const id of [...aimes].reverse()) {
    if (ids.length >= TITRES_PAR_MEMBRE) break;
    if (!vus.has(String(id))) ids.push(String(id));
  }
  return ids;
}

/**
 * Le Blend entre deux membres. Refusé si l'un ne suit pas l'autre, ou si
 * l'un des deux ne partage pas son activité : le Blend montre à chacun ce
 * que l'autre écoute, ce que le réglage de partage interdit justement.
 */
export async function blendEntre(moiId: string, amiUsername: string) {
  const [moi, ami] = await Promise.all([
    User.findById(moiId).select("name avatarUrl abonnementsMembres partageEcoute likedSongs").lean(),
    User.findOne({ username: amiUsername.toLowerCase(), suspended: { $ne: true } })
      .select("name username avatarUrl abonnementsMembres partageEcoute likedSongs")
      .lean(),
  ]);
  if (!moi || !ami) return null;
  if (String(ami._id) === moiId) throw new BlendRefuse("Un Blend se fait à deux.");

  const jeSuis = (moi.abonnementsMembres ?? []).some((id) => String(id) === String(ami._id));
  const ilMeSuit = (ami.abonnementsMembres ?? []).some((id) => String(id) === moiId);
  if (!jeSuis || !ilMeSuit) {
    throw new BlendRefuse(`Le Blend est réservé aux membres qui se suivent mutuellement : vous et ${ami.name}.`);
  }
  if (moi.partageEcoute === false || ami.partageEcoute === false) {
    throw new BlendRefuse(
      moi.partageEcoute === false
        ? "Le Blend mêle vos écoutes : activez « Partager mon activité d'écoute » pour en créer un."
        : `${ami.name} ne partage pas son activité d'écoute : le Blend n'est pas possible.`
    );
  }

  const [a, b] = await Promise.all([favoris(moi._id, moi.likedSongs ?? []), favoris(ami._id, ami.likedSongs ?? [])]);
  const titres = await Song.find({ _id: { $in: [...new Set([...a, ...b])] }, status: "published" })
    .populate("artist", "stageName verified coverUrl")
    .populate("album", "title coverUrl type")
    .lean();
  const parId = new Map(titres.map((t) => [String(t._id), t]));
  // Les titres retirés du catalogue sortent avant le mélange, pour ne pas laisser de trous.
  const publiesA = a.filter((id) => parId.has(id));
  const publiesB = b.filter((id) => parId.has(id));

  const artistes = (ids: string[]) =>
    ids.map((id) => parId.get(id)?.artist).filter(Boolean).map((ar) => String((ar as { _id: unknown })._id));

  return {
    moi: { name: moi.name, avatarUrl: moi.avatarUrl },
    ami: { name: ami.name, username: ami.username, avatarUrl: ami.avatarUrl },
    correspondance: correspondance(artistes(publiesA), artistes(publiesB)),
    titres: melangerBlend(publiesA, publiesB).map(({ id, pour }) => ({ titre: parId.get(id)!, pour })),
  };
}
