import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Play from "@/models/Play";
import Song from "@/models/Song";
import Artist from "@/models/Artist";
import User from "@/models/User";

/**
 * Ce que la plateforme a fait, mesuré.
 *
 * À distinguer de /api/admin/stats, qui **compte** : nombre de membres,
 * de titres, d'abonnements, avec leurs courbes. Ce module-ci **analyse** :
 * qui revient, qui décroche, ce qui sort de l'ordinaire, ce qui se
 * dessine. Deux besoins différents, deux fichiers.
 *
 * AUCUN CHIFFRE N'EST PRODUIT PAR UN MODÈLE
 *
 * Tout ce qui est ici sort d'une agrégation. Le modèle n'intervient qu'à
 * la fin (lib/ai/analyst.ts) pour interpréter, et il lui est interdit
 * d'écrire le moindre nombre. Un chiffre inventé dans un rapport
 * d'exploitation est pire qu'une absence de rapport : il se décide
 * dessus.
 */

const JOUR_MS = 86_400_000;
const SEMAINE_MS = 7 * JOUR_MS;

/** Lundi de référence (2024-01-01 était un lundi), pour numéroter les semaines. */
const LUNDI_ZERO = Date.UTC(2024, 0, 1);

/** Numéro de semaine absolu — comparable, sans dépendre du fuseau ni de l'année. */
export function cleSemaine(date: Date): number {
  return Math.floor((date.getTime() - LUNDI_ZERO) / SEMAINE_MS);
}

export type Audience = {
  ecoutes: number;
  auditeurs: number;
  /** Écoutes allées au bout, en part des écoutes. */
  tauxCompletion: number;
  /** Écoutes par auditeur identifié. */
  parAuditeur: number;
  /** Part d'écoutes lancées sans compte. */
  partAnonyme: number;
};

/** L'audience d'une période. */
export async function audience(from: Date, to: Date): Promise<Audience> {
  await connectDB();
  const [ligne] = await Play.aggregate<{
    ecoutes: number;
    completes: number;
    anonymes: number;
    auditeurs: (Types.ObjectId | null)[];
  }>([
    { $match: { playedAt: { $gte: from, $lt: to } } },
    {
      $group: {
        _id: null,
        ecoutes: { $sum: 1 },
        completes: { $sum: { $cond: ["$completed", 1, 0] } },
        anonymes: { $sum: { $cond: [{ $eq: ["$user", null] }, 1, 0] } },
        auditeurs: { $addToSet: "$user" },
      },
    },
  ]);

  if (!ligne || ligne.ecoutes === 0) {
    return { ecoutes: 0, auditeurs: 0, tauxCompletion: 0, parAuditeur: 0, partAnonyme: 0 };
  }

  // `$addToSet` range toutes les écoutes anonymes sous une seule valeur
  // nulle : on la retire plutôt que de la compter comme un auditeur.
  const auditeurs = ligne.auditeurs.filter((a) => a !== null && a !== undefined).length;

  return {
    ecoutes: ligne.ecoutes,
    auditeurs,
    tauxCompletion: ligne.completes / ligne.ecoutes,
    parAuditeur: auditeurs > 0 ? (ligne.ecoutes - ligne.anonymes) / auditeurs : 0,
    partAnonyme: ligne.anonymes / ligne.ecoutes,
  };
}

export type Comportement = {
  /** Répartition des écoutes par tranche horaire (heure UTC). */
  parHeure: number[];
  /** Répartition par appareil déclaré. */
  parAppareil: { appareil: string; ecoutes: number }[];
  /** Part d'écoutes coupées avant le quart du morceau. */
  tauxAbandon: number;
  /** Auditeurs ayant écouté un seul titre sur la période. */
  auditeursDUnSeulTitre: number;
};

/**
 * Comment on écoute, plutôt que combien.
 *
 * Le taux d'abandon est la mesure la plus utile du lot : il dit si le
 * catalogue retient. Une audience qui monte avec un abandon qui monte
 * aussi n'est pas une bonne nouvelle.
 */
export async function comportement(from: Date, to: Date): Promise<Comportement> {
  await connectDB();

  const [heures, appareils, abandons, uniques] = await Promise.all([
    Play.aggregate<{ _id: number; n: number }>([
      { $match: { playedAt: { $gte: from, $lt: to } } },
      { $group: { _id: { $hour: { date: "$playedAt", timezone: "UTC" } }, n: { $sum: 1 } } },
    ]),
    Play.aggregate<{ _id: string | null; n: number }>([
      { $match: { playedAt: { $gte: from, $lt: to } } },
      { $group: { _id: "$device", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ]),
    Play.aggregate<{ total: number; coupes: number }>([
      { $match: { playedAt: { $gte: from, $lt: to } } },
      { $lookup: { from: "songs", localField: "song", foreignField: "_id", as: "s" } },
      { $unwind: "$s" },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          coupes: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$completed", false] },
                    { $gt: ["$s.duration", 0] },
                    { $lt: [{ $divide: ["$secondsListened", "$s.duration"] }, 0.25] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    Play.aggregate<{ _id: null; n: number }>([
      { $match: { playedAt: { $gte: from, $lt: to }, user: { $ne: null } } },
      { $group: { _id: { user: "$user", song: "$song" } } },
      { $group: { _id: "$_id.user", titres: { $sum: 1 } } },
      { $match: { titres: 1 } },
      { $group: { _id: null, n: { $sum: 1 } } },
    ]),
  ]);

  const parHeure = Array.from({ length: 24 }, (_, h) => heures.find((x) => x._id === h)?.n ?? 0);

  return {
    parHeure,
    parAppareil: appareils.map((a) => ({ appareil: a._id ?? "inconnu", ecoutes: a.n })),
    tauxAbandon: abandons[0]?.total ? abandons[0].coupes / abandons[0].total : 0,
    auditeursDUnSeulTitre: uniques[0]?.n ?? 0,
  };
}

export type ArtisteEnMouvement = {
  id: string;
  nom: string;
  ecoutes: number;
  ecoutesAvant: number;
  /** Rapport entre la semaine et la précédente, lissé. */
  progression: number;
};

/** Lissage : sans lui, passer de 1 à 6 écoutes afficherait +500 %. */
const LISSAGE = 8;
/** En deçà, la variation ne mesure que le hasard. */
const SOCLE = 10;

/**
 * Les artistes qui montent et ceux qui décrochent.
 *
 * Les deux listes comptent autant : voir qu'un artiste jusque-là écouté
 * ne l'est plus est une information d'exploitation, pas une mauvaise
 * nouvelle à cacher.
 */
export async function artistesEnMouvement(
  from: Date,
  to: Date,
  precedenteFrom: Date,
  precedenteTo: Date,
  limite = 5
): Promise<{ montent: ArtisteEnMouvement[]; decrochent: ArtisteEnMouvement[] }> {
  await connectDB();

  const parArtiste = async (debut: Date, fin: Date) => {
    const lignes = await Play.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { playedAt: { $gte: debut, $lt: fin } } },
      { $lookup: { from: "songs", localField: "song", foreignField: "_id", as: "s" } },
      { $unwind: "$s" },
      { $group: { _id: "$s.artist", n: { $sum: 1 } } },
    ]);
    return new Map(lignes.map((l) => [String(l._id), l.n]));
  };

  const [maintenant, avant] = await Promise.all([
    parArtiste(from, to),
    parArtiste(precedenteFrom, precedenteTo),
  ]);

  const ids = [...new Set([...maintenant.keys(), ...avant.keys()])].filter((id) =>
    Types.ObjectId.isValid(id)
  );
  if (ids.length === 0) return { montent: [], decrochent: [] };

  const noms = new Map(
    (await Artist.find({ _id: { $in: ids.map((i) => new Types.ObjectId(i)) } }).select("stageName"))
      .map((a) => [a._id.toString(), a.stageName])
  );

  const lignes: ArtisteEnMouvement[] = ids.map((id) => {
    const n = maintenant.get(id) ?? 0;
    const p = avant.get(id) ?? 0;
    return {
      id,
      nom: noms.get(id) ?? "Artiste supprimé",
      ecoutes: n,
      ecoutesAvant: p,
      progression: (n + LISSAGE) / (p + LISSAGE),
    };
  });

  return {
    montent: lignes
      .filter((l) => l.ecoutes >= SOCLE && l.progression > 1.2)
      .sort((a, b) => b.progression - a.progression)
      .slice(0, limite),
    decrochent: lignes
      .filter((l) => l.ecoutesAvant >= SOCLE && l.progression < 0.8)
      .sort((a, b) => a.progression - b.progression)
      .slice(0, limite),
  };
}

export type TendanceGenre = { genre: string; ecoutes: number; ecoutesAvant: number; progression: number };

/** Les genres qui portent l'écoute, et leur mouvement. */
export async function tendancesGenres(
  from: Date,
  to: Date,
  precedenteFrom: Date,
  precedenteTo: Date,
  limite = 6
): Promise<TendanceGenre[]> {
  await connectDB();

  const parGenre = async (debut: Date, fin: Date) => {
    const lignes = await Play.aggregate<{ _id: string; n: number }>([
      { $match: { playedAt: { $gte: debut, $lt: fin } } },
      { $lookup: { from: "songs", localField: "song", foreignField: "_id", as: "s" } },
      { $unwind: "$s" },
      { $group: { _id: "$s.genre", n: { $sum: 1 } } },
    ]);
    return new Map(lignes.filter((l) => l._id).map((l) => [l._id, l.n]));
  };

  const [maintenant, avant] = await Promise.all([
    parGenre(from, to),
    parGenre(precedenteFrom, precedenteTo),
  ]);

  return [...new Set([...maintenant.keys(), ...avant.keys()])]
    .map((genre) => {
      const n = maintenant.get(genre) ?? 0;
      const p = avant.get(genre) ?? 0;
      return { genre, ecoutes: n, ecoutesAvant: p, progression: (n + LISSAGE) / (p + LISSAGE) };
    })
    .sort((a, b) => b.ecoutes - a.ecoutes)
    .slice(0, limite);
}

export type Catalogue = {
  titresPublies: number;
  sortiesDeLaPeriode: number;
  /** Titres publiés n'ayant jamais été écoutés. */
  jamaisEcoutes: number;
  artistes: number;
  nouveauxMembres: number;
};

/** L'état du catalogue et de l'inscription. */
export async function catalogue(from: Date, to: Date): Promise<Catalogue> {
  await connectDB();

  const [titresPublies, sorties, artistes, nouveauxMembres, ecoutesDistinctes] = await Promise.all([
    Song.countDocuments({ status: "published" }),
    Song.countDocuments({ status: "published", releaseDate: { $gte: from, $lt: to } }),
    Artist.countDocuments(),
    User.countDocuments({ role: "member", createdAt: { $gte: from, $lt: to } }),
    Play.distinct("song"),
  ]);

  // « Jamais écouté » se mesure sur toute l'histoire, pas sur la fenêtre :
  // un titre écouté l'an dernier n'est pas un titre ignoré.
  const ecoutesSet = new Set(ecoutesDistinctes.map((s) => String(s)));
  const publies = await Song.find({ status: "published" }).select("_id").lean();
  const jamaisEcoutes = publies.filter((s) => !ecoutesSet.has(String(s._id))).length;

  return { titresPublies, sortiesDeLaPeriode: sorties, jamaisEcoutes, artistes, nouveauxMembres };
}
