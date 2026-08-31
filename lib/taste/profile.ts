import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Play from "@/models/Play";
import User from "@/models/User";
import type { Univers } from "@/lib/univers";

/**
 * Ce qu'un auditeur écoute, mesuré plutôt que déclaré.
 *
 * Personne ne remplit de questionnaire de goûts : le profil se déduit des
 * écoutes et des « j'aime ». Il sert de socle à la station personnalisée
 * (lib/taste/station.ts) et à l'explication de chaque proposition.
 *
 * TROIS CHOSES QUE CE PROFIL FAIT, ET QUI COMPTENT
 *
 * 1. **Il oublie.** Une écoute d'il y a trois mois pèse moins qu'une
 *    écoute d'hier. Sans décroissance, le profil resterait figé sur une
 *    passade de l'hiver dernier et proposerait indéfiniment la même
 *    chose.
 *
 * 2. **Il compte les abandons contre.** Un morceau lancé puis coupé
 *    plusieurs fois est un refus, pas un goût. C'est le signal le plus
 *    utile et le plus souvent ignoré : sans lui, une station reproposerait
 *    sans fin ce que l'auditeur saute à chaque fois — et rien n'agace
 *    davantage.
 *
 * 3. **Il dit quand il ne sait pas.** Un compte de trois écoutes ne
 *    permet aucune personnalisation. `assezDeDonnees` vaut alors faux, et
 *    l'appelant sert ce que tout le monde écoute plutôt qu'une
 *    recommandation batie sur rien.
 *
 * UN PROFIL PAR UNIVERS, ET NON UN PROFIL PARTAGÉ
 *
 * Le profil se lit dans un seul univers à la fois. C'est la condition
 * pour que les deux répertoires soient réellement indépendants : sans
 * cela, quelqu'un qui écoute du gospel le dimanche et de la variété le
 * reste de la semaine verrait ses deux stations converger vers le même
 * milieu, celui qui ne ressemble à aucune des deux. Un compte a donc
 * deux profils, mesurés sur deux historiques disjoints.
 */

/** Fenêtre d'observation. Au-delà, une écoute ne dit plus rien du goût actuel. */
const FENETRE_JOURS = 90;
/** Demi-vie de la pondération : une écoute de ce jour-là pèse moitié moins qu'aujourd'hui. */
const DEMI_VIE_JOURS = 30;
/** En deçà, il n'y a pas de goût à lire, seulement du hasard. */
const ECOUTES_MIN = 8;
/** Abandons répétés au-delà desquels un titre est tenu pour refusé. */
const ABANDONS_REFUS = 3;
/** Part d'un morceau en deçà de laquelle on parle d'abandon. */
const SEUIL_ABANDON = 0.25;

export type Poids = { cle: string; poids: number };

export type ProfilGouts = {
  /** Vrai quand l'historique suffit à personnaliser quoi que ce soit. */
  assezDeDonnees: boolean;
  ecoutes: number;
  genres: Poids[];
  artistes: Poids[];
  langues: Poids[];
  /** Titres déjà entendus, avec leur nombre d'écoutes retenues. */
  connus: Map<string, number>;
  /** Titres explicitement aimés. */
  favoris: Set<string>;
  /** Titres lancés puis coupés plusieurs fois : à ne pas represser. */
  refuses: Set<string>;
  /** Artistes dont il a écouté au moins un titre en entier. */
  artistesConnus: Set<string>;
};

/** Profil vide — celui d'un visiteur, ou d'un compte qui vient d'arriver. */
export function profilVide(): ProfilGouts {
  return {
    assezDeDonnees: false,
    ecoutes: 0,
    genres: [],
    artistes: [],
    langues: [],
    connus: new Map(),
    favoris: new Set(),
    refuses: new Set(),
    artistesConnus: new Set(),
  };
}

/** Décroissance exponentielle : 1 aujourd'hui, 0,5 après une demi-vie. */
function poidsAge(quand: Date, maintenant: number): number {
  const jours = (maintenant - quand.getTime()) / 86_400_000;
  return Math.pow(0.5, jours / DEMI_VIE_JOURS);
}

function classer(carte: Map<string, number>, limite: number): Poids[] {
  return [...carte.entries()]
    .filter(([cle]) => cle.length > 0)
    .map(([cle, poids]) => ({ cle, poids: Math.round(poids * 100) / 100 }))
    .sort((a, b) => b.poids - a.poids)
    .slice(0, limite);
}

type LigneEcoute = {
  playedAt: Date;
  secondsListened: number;
  completed: boolean;
  song: {
    _id: Types.ObjectId;
    genre?: string;
    language?: string;
    duration?: number;
    artist?: Types.ObjectId;
  } | null;
};

/**
 * Lit le profil d'un compte.
 *
 * Un seul aller-retour en base pour les écoutes, un pour les favoris :
 * cette fonction est appelée à chaque lancement de station, elle ne doit
 * pas coûter davantage.
 */
export async function profilDe(userId: string, univers: Univers): Promise<ProfilGouts> {
  await connectDB();

  const depuis = new Date(Date.now() - FENETRE_JOURS * 86_400_000);
  const [ecoutes, utilisateur] = await Promise.all([
    Play.find({ user: userId, univers, playedAt: { $gte: depuis } })
      .select("playedAt secondsListened completed song")
      .populate({ path: "song", select: "genre language duration artist" })
      .lean() as unknown as Promise<LigneEcoute[]>,
    User.findById(userId).select("likedSongs").lean(),
  ]);

  const profil = profilVide();
  const favoris = ((utilisateur as { likedSongs?: Types.ObjectId[] } | null)?.likedSongs ?? []).map((s) =>
    s.toString()
  );
  profil.favoris = new Set(favoris);

  const maintenant = Date.now();
  const genres = new Map<string, number>();
  const artistes = new Map<string, number>();
  const langues = new Map<string, number>();
  const abandons = new Map<string, number>();

  for (const e of ecoutes) {
    // Un titre supprimé depuis reste dans l'historique : il ne dit plus
    // rien d'un catalogue où il n'existe plus.
    if (!e.song?._id) continue;
    const id = e.song._id.toString();

    const duree = e.song.duration ?? 0;
    const part = duree > 0 ? e.secondsListened / duree : e.completed ? 1 : 0;

    // Abandon : lancé, puis coupé très tôt. Compté à part, jamais comme
    // un goût — c'est le contraire d'un goût.
    if (!e.completed && part > 0 && part < SEUIL_ABANDON) {
      abandons.set(id, (abandons.get(id) ?? 0) + 1);
      continue;
    }

    const poids = poidsAge(e.playedAt, maintenant) * (e.completed ? 1 : Math.max(part, 0.2));
    profil.ecoutes += 1;
    profil.connus.set(id, (profil.connus.get(id) ?? 0) + 1);

    if (e.song.genre) genres.set(e.song.genre, (genres.get(e.song.genre) ?? 0) + poids);
    if (e.song.language) langues.set(e.song.language, (langues.get(e.song.language) ?? 0) + poids);
    if (e.song.artist) {
      const a = e.song.artist.toString();
      artistes.set(a, (artistes.get(a) ?? 0) + poids);
      if (e.completed) profil.artistesConnus.add(a);
    }
  }

  // Un titre à la fois beaucoup abandonné et jamais fini est un refus.
  // Celui qu'on a fini au moins une fois ne l'est pas : on l'a peut-être
  // simplement coupé pour partir.
  for (const [id, fois] of abandons) {
    if (fois >= ABANDONS_REFUS && !profil.connus.has(id)) profil.refuses.add(id);
  }

  profil.genres = classer(genres, 8);
  profil.artistes = classer(artistes, 20);
  profil.langues = classer(langues, 4);
  profil.assezDeDonnees = profil.ecoutes >= ECOUTES_MIN && profil.genres.length > 0;

  return profil;
}

/** Les identifiants d'artistes du profil, les plus écoutés d'abord. */
export function artistesPreferes(profil: ProfilGouts, limite = 10): string[] {
  return profil.artistes.slice(0, limite).map((a) => a.cle);
}

/** Les genres du profil, les plus écoutés d'abord. */
export function genresPreferes(profil: ProfilGouts, limite = 5): string[] {
  return profil.genres.slice(0, limite).map((g) => g.cle);
}
