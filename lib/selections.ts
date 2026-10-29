import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import Play from "@/models/Play";
import Artist from "@/models/Artist";
import User from "@/models/User";
import SelectionPersonnelle, { type ISelectionPersonnelle, type TypeSelection } from "@/models/SelectionPersonnelle";
import type { Univers } from "@/lib/univers";
import {
  composerDecouvertes,
  composerMix,
  composerRadar,
  descriptionMix,
  genresDesMix,
  goutsDe,
  graineDe,
  periodeDeLaSemaine,
  periodeDuJour,
  type Ecoute,
  type TitreLeger,
} from "@/lib/selectionsCalcul";

/**
 * Les sélections personnelles, à la manière de Spotify :
 * - six Mix du jour au plus, un par genre que l'auditeur écoute, renouvelés
 *   chaque jour ;
 * - les Découvertes de la semaine, trente titres jamais écoutés, renouvelées
 *   le lundi ;
 * - le Radar des sorties : les nouveautés des artistes suivis ou écoutés.
 *
 * Chaque sélection est calculée à la première visite de sa période puis
 * gardée (models/SelectionPersonnelle.ts). Un visiteur reçoit des mix
 * communs, tirés des genres les plus fournis du catalogue.
 *
 * Le calcul lui-même vit dans lib/selectionsCalcul.ts, sans base de données.
 */

const JOUR_MS = 86_400_000;
/** Les écoutes qui disent le goût : celles des quatre derniers mois. */
const FENETRE_ECOUTES_JOURS = 120;
/** Un titre sorti il y a moins de trois semaines est une nouveauté. */
const FENETRE_RADAR_JOURS = 21;
/** Les titres considérés pour un mix : les plus écoutés de son genre. */
const CANDIDATS_PAR_GENRE = 150;
const CHAMPS_LEGERS = "artist genre playsCount releaseDate coverUrl";

const SEMAINE_MS = 7 * JOUR_MS;

export type ResumeSelection = {
  cle: string;
  type: TypeSelection;
  rang: number;
  titre: string;
  description: string;
  genre?: string;
  couverture?: string;
  nombre: number;
};

/** « mix-1 » … « mix-6 », « decouvertes », « radar » : l'adresse d'une sélection. */
export function cleDe(s: Pick<ISelectionPersonnelle, "type" | "rang">): string {
  return s.type === "mix" ? `mix-${s.rang}` : s.type;
}

type SongLeger = { _id: Types.ObjectId; artist: Types.ObjectId; genre?: string; playsCount?: number; releaseDate?: Date; coverUrl?: string };

function leger(s: SongLeger): TitreLeger {
  return { _id: String(s._id), artiste: String(s.artist), genre: s.genre, playsCount: s.playsCount ?? 0, releaseDate: s.releaseDate };
}

/** Ce que le compte a écouté ces derniers mois, avec ses « j'aime ». */
async function ecoutesDe(userId: string, univers: Univers, maintenant: Date): Promise<Ecoute[]> {
  const depuis = new Date(maintenant.getTime() - FENETRE_ECOUTES_JOURS * JOUR_MS);
  const [parTitre, compte] = await Promise.all([
    Play.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { user: new Types.ObjectId(userId), univers, playedAt: { $gte: depuis } } },
      { $group: { _id: "$song", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 400 },
    ]),
    User.findById(userId).select("likedSongs").lean<{ likedSongs?: Types.ObjectId[] }>(),
  ]);
  const ecoutes = new Map(parTitre.map((p) => [String(p._id), p.n]));
  const aimes = new Set((compte?.likedSongs ?? []).map(String));
  const ids = [...new Set([...ecoutes.keys(), ...aimes])];
  if (ids.length === 0) return [];
  const titres = await Song.find({ _id: { $in: ids }, status: "published", univers }).select(CHAMPS_LEGERS).lean<SongLeger[]>();
  return titres.map((t) => ({ titre: leger(t), poids: (ecoutes.get(String(t._id)) ?? 0) + (aimes.has(String(t._id)) ? 2 : 0) }));
}

/** Les genres les plus fournis du catalogue, pour les mix d'un visiteur ou d'un nouveau compte. */
async function genresPopulaires(univers: Univers): Promise<string[]> {
  const parGenre = await Song.aggregate<{ _id: string }>([
    { $match: { status: "published", univers } },
    { $group: { _id: "$genre", n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]);
  return parGenre.map((g) => g._id).filter((g) => g && g.toLowerCase() !== "autre");
}

async function nomsEtPhotos(ids: string[]) {
  const artistes = await Artist.find({ _id: { $in: [...new Set(ids)] } }).select("stageName coverUrl").lean<{ _id: Types.ObjectId; stageName: string; coverUrl?: string }[]>();
  return new Map(artistes.map((a) => [String(a._id), a]));
}

type Brouillon = Omit<ISelectionPersonnelle, "createdAt">;

async function composerLesMix(userId: string | null, univers: Univers, maintenant: Date, periode: string): Promise<Brouillon[]> {
  const ecoutes = userId ? await ecoutesDe(userId, univers, maintenant) : [];
  const gouts = goutsDe(ecoutes);
  let genres = genresDesMix(gouts);
  // Un nouveau compte, ou un visiteur, n'a pas encore assez écouté pour
  // qu'un genre se dégage : les genres les plus fournis complètent.
  if (genres.length < 3) {
    const populaires = await genresPopulaires(univers);
    genres = [...genres, ...populaires.filter((g) => !genres.includes(g))].slice(0, userId ? Math.max(3, genres.length) : 6);
  }

  const artistesAimes = new Map(gouts.artistes);
  const composes = await Promise.all(
    genres.map(async (genre, i) => {
      const candidats = await Song.find({ status: "published", univers, genre })
        .select(CHAMPS_LEGERS)
        .sort({ playsCount: -1 })
        .limit(CANDIDATS_PAR_GENRE)
        .lean<SongLeger[]>();
      const familiers = ecoutes
        .filter((e) => e.titre.genre === genre)
        .sort((a, b) => b.poids - a.poids)
        .map((e) => e.titre);
      const titres = composerMix({
        familiers,
        candidats: candidats.map(leger),
        artistesAimes,
        graine: graineDe(`${userId ?? "visiteur"}|${univers}|${periode}|${genre}`),
      });
      // Les artistes mis en avant : ceux que l'auditeur écoute dans ce
      // genre, puis ceux du mix.
      const enTete = [...familiers.map((t) => t.artiste), ...titres.map((t) => t.artiste)];
      return { rang: i + 1, genre, titres, enTete, couvertureSecours: candidats.find((c) => c._id && String(c._id) === titres[0]?._id)?.coverUrl };
    })
  );

  const noms = await nomsEtPhotos(composes.flatMap((c) => c.enTete.slice(0, 8)));
  const expireLe = new Date(maintenant.getTime() + 2 * JOUR_MS);
  return composes
    .filter((c) => c.titres.length >= 5)
    .map((c, i) => {
      const principal = c.enTete.map((id) => noms.get(id)).find((a) => a?.coverUrl);
      return {
        user: userId ? new Types.ObjectId(userId) : null,
        univers,
        type: "mix" as const,
        rang: i + 1,
        periode,
        titre: userId ? `Mix du jour ${i + 1}` : `Mix ${c.genre}`,
        description: descriptionMix(c.enTete.map((id) => noms.get(id)?.stageName ?? "")),
        genre: c.genre,
        couverture: principal?.coverUrl ?? c.couvertureSecours,
        titres: c.titres.map((t) => new Types.ObjectId(t._id)),
        expireLe,
      };
    });
}

async function composerLesDecouvertes(userId: string, univers: Univers, maintenant: Date, periode: string): Promise<Brouillon> {
  const ecoutes = await ecoutesDe(userId, univers, maintenant);
  const gouts = goutsDe(ecoutes);
  // Tout ce que le compte a déjà écouté, même il y a longtemps : une
  // découverte est un titre qu'il ne connaît pas.
  const dejaJoues = await Play.distinct("song", { user: new Types.ObjectId(userId) });
  const dejaEcoutes = new Set([...dejaJoues.map(String), ...ecoutes.map((e) => e.titre._id)]);

  let genres = gouts.genres.slice(0, 5).map(([g]) => g);
  if (genres.length === 0) genres = (await genresPopulaires(univers)).slice(0, 5);
  let candidats = await Song.find({ status: "published", univers, genre: { $in: genres } }).select(CHAMPS_LEGERS).limit(500).lean<SongLeger[]>();
  if (candidats.filter((c) => !dejaEcoutes.has(String(c._id))).length < 30) {
    // Pas assez de nouveautés dans ses genres : les titres qui marchent
    // ailleurs complètent.
    const ailleurs = await Song.find({ status: "published", univers, genre: { $nin: genres } })
      .select(CHAMPS_LEGERS)
      .sort({ playsCount: -1 })
      .limit(120)
      .lean<SongLeger[]>();
    candidats = [...candidats, ...ailleurs];
  }
  const titres = composerDecouvertes({
    candidats: candidats.map(leger),
    gouts,
    dejaEcoutes,
    graine: graineDe(`${userId}|${univers}|${periode}|decouvertes`),
    maintenant,
  });
  return {
    user: new Types.ObjectId(userId),
    univers,
    type: "decouvertes",
    rang: 0,
    periode,
    titre: "Découvertes de la semaine",
    description: "Des titres que vous n'avez jamais écoutés, choisis d'après vos goûts. Renouvelées chaque lundi.",
    titres: titres.map((t) => new Types.ObjectId(t._id)),
    expireLe: new Date(maintenant.getTime() + SEMAINE_MS + JOUR_MS),
  };
}

async function composerLeRadar(userId: string, univers: Univers, maintenant: Date, periode: string): Promise<Brouillon> {
  const [suivis, ecoutes] = await Promise.all([
    Artist.find({ followers: new Types.ObjectId(userId) }).select("_id").lean<{ _id: Types.ObjectId }[]>(),
    ecoutesDe(userId, univers, maintenant),
  ]);
  // Les artistes suivis, et les dix que le compte écoute le plus : on
  // n'attend pas d'un auditeur qu'il suive tous ceux qu'il aime.
  const artistes = new Set([...suivis.map((a) => String(a._id)), ...goutsDe(ecoutes).artistes.slice(0, 10).map(([a]) => a)]);
  const recents = artistes.size
    ? await Song.find({
        status: "published",
        univers,
        artist: { $in: [...artistes] },
        releaseDate: { $gte: new Date(maintenant.getTime() - FENETRE_RADAR_JOURS * JOUR_MS), $lte: maintenant },
      })
        .select(CHAMPS_LEGERS)
        .lean<SongLeger[]>()
    : [];
  const titres = composerRadar({ recents: recents.map(leger), artistesSuivis: artistes });
  return {
    user: new Types.ObjectId(userId),
    univers,
    type: "radar",
    rang: 0,
    periode,
    titre: "Radar des sorties",
    description: "Les nouveautés des artistes que vous suivez et que vous écoutez le plus.",
    titres: titres.map((t) => new Types.ObjectId(t._id)),
    expireLe: new Date(maintenant.getTime() + 2 * JOUR_MS),
  };
}

/** Garde une sélection ; si une requête simultanée l'a déjà gardée, c'est la sienne qui compte. */
async function garder(brouillon: Brouillon): Promise<void> {
  const cle = { user: brouillon.user, univers: brouillon.univers, type: brouillon.type, rang: brouillon.rang, periode: brouillon.periode };
  try {
    await SelectionPersonnelle.updateOne(cle, { $setOnInsert: brouillon }, { upsert: true });
  } catch (e) {
    if ((e as { code?: number }).code !== 11000) throw e;
  }
}

/**
 * Les sélections du compte (ou d'un visiteur) pour aujourd'hui, calculées
 * à la première demande de leur période. Une sélection vide (aucune
 * nouveauté au radar) est gardée aussi, pour ne pas la recalculer à chaque
 * visite, mais n'est pas rendue.
 */
export async function selectionsDe(userId: string | null, univers: Univers, maintenant = new Date()): Promise<ISelectionPersonnelle[]> {
  await connectDB();
  const jour = periodeDuJour(maintenant);
  const semaine = periodeDeLaSemaine(maintenant);
  const user = userId ? new Types.ObjectId(userId) : null;
  const lire = () =>
    SelectionPersonnelle.find({
      user,
      univers,
      $or: [{ type: "mix", periode: jour }, { type: "radar", periode: jour }, { type: "decouvertes", periode: semaine }],
    }).lean<ISelectionPersonnelle[]>();

  let gardees = await lire();
  const manque: Promise<void>[] = [];
  if (!gardees.some((s) => s.type === "mix")) {
    manque.push(composerLesMix(userId, univers, maintenant, jour).then((mix) => Promise.all(mix.map(garder)).then(() => undefined)));
  }
  if (userId && !gardees.some((s) => s.type === "decouvertes")) {
    manque.push(composerLesDecouvertes(userId, univers, maintenant, semaine).then(garder));
  }
  if (userId && !gardees.some((s) => s.type === "radar")) {
    manque.push(composerLeRadar(userId, univers, maintenant, jour).then(garder));
  }
  if (manque.length > 0) {
    await Promise.all(manque);
    gardees = await lire();
  }

  const ordre: Record<TypeSelection, number> = { mix: 0, decouvertes: 1, radar: 2 };
  return gardees.filter((s) => s.titres.length > 0).sort((a, b) => ordre[a.type] - ordre[b.type] || a.rang - b.rang);
}

export function resumeDe(s: ISelectionPersonnelle): ResumeSelection {
  return {
    cle: cleDe(s),
    type: s.type,
    rang: s.rang,
    titre: s.titre,
    description: s.description,
    genre: s.genre,
    couverture: s.couverture,
    nombre: s.titres.length,
  };
}

/** Une sélection et ses titres publiés, dans leur ordre ; null si elle n'existe pas pour ce compte. */
export async function selectionDe(userId: string | null, univers: Univers, cle: string) {
  const toutes = await selectionsDe(userId, univers);
  const selection = toutes.find((s) => cleDe(s) === cle);
  if (!selection) return null;
  const titres = await Song.find({ _id: { $in: selection.titres }, status: "published" })
    .populate("artist", "stageName verified")
    .populate("featuring.artist", "stageName verified");
  const rang = new Map(selection.titres.map((id, i) => [String(id), i]));
  titres.sort((a, b) => (rang.get(String(a._id)) ?? 0) - (rang.get(String(b._id)) ?? 0));
  return { selection: resumeDe(selection), titres };
}
