import { Types } from "mongoose";
import User from "@/models/User";
import Play from "@/models/Play";
import Song from "@/models/Song";

/**
 * Les liens entre membres : qui suit qui, et ce que les membres suivis
 * écoutent.
 *
 * Suivre est à sens unique, sans demande à accepter : on voit l'activité
 * de ceux qu'on suit, s'ils la partagent. Ce qui protège un compte, c'est
 * son réglage `partageEcoute`, pas le refus d'un abonné : celui qui ne
 * veut pas être vu coupe le partage, et plus personne ne le voit.
 */

/** Au-delà, une écoute n'est plus de « l'activité » mais de l'histoire. */
const FENETRE_ACTIVITE_MS = 14 * 24 * 3600 * 1000;

export type AmiPublic = { _id: string; name: string; username?: string; avatarUrl?: string };

function enAmi(u: { _id: Types.ObjectId; name: string; username?: string; avatarUrl?: string }): AmiPublic {
  return { _id: u._id.toString(), name: u.name, username: u.username, avatarUrl: u.avatarUrl };
}

/** Suit ou cesse de suivre un membre. Renvoie le nouveau nombre d'abonnés de ce membre. */
export async function suivreMembre(moiId: string, cibleId: string, suivre: boolean): Promise<number> {
  if (moiId === cibleId) throw new Error("soi-meme");
  await User.updateOne(
    { _id: moiId },
    suivre ? { $addToSet: { abonnementsMembres: cibleId } } : { $pull: { abonnementsMembres: cibleId } }
  );
  return User.countDocuments({ abonnementsMembres: cibleId });
}

/** Ce qu'un profil montre de ses liens, vu par `moiId` (absent si visiteur anonyme). */
export async function liensDuProfil(cibleId: string, moiId?: string) {
  const [abonnes, cible, moi] = await Promise.all([
    User.countDocuments({ abonnementsMembres: cibleId }),
    User.findById(cibleId).select("abonnementsMembres").lean(),
    moiId ? User.findById(moiId).select("abonnementsMembres").lean() : null,
  ]);
  const suivi = !!moi?.abonnementsMembres?.some((id) => String(id) === cibleId);
  const meSuit = !!moiId && !!cible?.abonnementsMembres?.some((id) => String(id) === moiId);
  return {
    abonnes,
    abonnements: cible?.abonnementsMembres?.length ?? 0,
    estMoi: moiId === cibleId,
    suivi,
    // Le Blend n'est proposé qu'entre deux comptes qui se suivent : il mêle
    // les goûts de l'un et de l'autre, l'un ne l'impose pas à l'autre.
    mutuel: suivi && meSuit,
  };
}

/** Les membres que `moiId` suit, avec pour chacun s'il le suit en retour. */
export async function mesAbonnements(moiId: string) {
  const moi = await User.findById(moiId).select("abonnementsMembres partageEcoute").lean();
  const ids = moi?.abonnementsMembres ?? [];
  const membres = await User.find({ _id: { $in: ids }, suspended: { $ne: true } })
    .select("name username avatarUrl abonnementsMembres")
    .lean();
  return {
    partageEcoute: moi?.partageEcoute !== false,
    abonnements: membres.map((m) => ({
      ...enAmi(m),
      mutuel: (m.abonnementsMembres ?? []).some((id) => String(id) === moiId),
    })),
  };
}

/**
 * La dernière écoute de chaque membre suivi qui partage son activité, la
 * plus récente d'abord. Un titre retiré du catalogue depuis n'est pas
 * montré : on ne fait pas la publicité d'un brouillon.
 */
export async function activiteDesAmis(moiId: string) {
  const moi = await User.findById(moiId).select("abonnementsMembres").lean();
  const amis = await User.find({
    _id: { $in: moi?.abonnementsMembres ?? [] },
    partageEcoute: { $ne: false },
    suspended: { $ne: true },
  })
    .select("name username avatarUrl")
    .lean();
  if (amis.length === 0) return [];

  const dernieres: { _id: Types.ObjectId; song: Types.ObjectId; playedAt: Date }[] = await Play.aggregate([
    { $match: { user: { $in: amis.map((a) => a._id) }, playedAt: { $gte: new Date(Date.now() - FENETRE_ACTIVITE_MS) } } },
    { $sort: { playedAt: -1 } },
    { $group: { _id: "$user", song: { $first: "$song" }, playedAt: { $first: "$playedAt" } } },
  ]);

  const titres = await Song.find({ _id: { $in: dernieres.map((d) => d.song) }, status: "published" })
    .populate("artist", "stageName verified coverUrl")
    .populate("album", "title coverUrl type")
    .lean();
  const titreParId = new Map(titres.map((t) => [String(t._id), t]));
  const amiParId = new Map(amis.map((a) => [String(a._id), a]));

  return dernieres
    .filter((d) => titreParId.has(String(d.song)) && amiParId.has(String(d._id)))
    .sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime())
    .map((d) => ({
      ami: enAmi(amiParId.get(String(d._id))!),
      titre: titreParId.get(String(d.song))!,
      ecouteLe: d.playedAt,
    }));
}
