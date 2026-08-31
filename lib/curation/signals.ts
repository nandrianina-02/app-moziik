import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Play from "@/models/Play";
import Song from "@/models/Song";
import { normaliser } from "@/lib/searchText";
import { rechercheGlobale } from "@/lib/search";
import { termesLesPlusCherches, volumeRecherches } from "@/lib/searchJournal";
import type { Fenetre } from "@/lib/curation/window";
import type { Univers } from "@/lib/univers";

/**
 * Ce que la semaine dit, en chiffres.
 *
 * Ce fichier ne décide rien : il mesure. Les recettes
 * (lib/curation/recipes.ts) choisissent ensuite quoi faire de ces
 * mesures. La séparation compte, parce que les deux se vérifient
 * différemment — une mesure se compare à la base, une recette se juge à
 * l'écoute.
 *
 * UNE ÉCOUTE N'EST PAS UNE VOIX
 *
 * Un classement bâti sur le nombre brut d'écoutes ne classe pas les
 * morceaux, il classe les auditeurs les plus insistants : mille lectures
 * lancées par une seule personne — ou par une boucle — pèsent autant que
 * mille auditeurs distincts. La contribution d'un même compte est donc
 * plafonnée, et celle des écoutes anonymes l'est globalement.
 *
 * CE QUI N'EST PAS MESURABLE ICI, ET POURQUOI
 *
 * Les « j'aime » de la semaine. `User.likedSongs` est un tableau de
 * références sans date, et `Song.likesCount` un compteur cumulé : rien ne
 * permet de savoir *quand* un titre a été aimé. La recette « les plus
 * aimés » s'appuie donc sur un taux d'appréciation cumulé, ce qui est
 * autre chose — et c'est dit à l'écran plutôt que laissé à croire.
 *
 * TOUT EST MESURÉ DANS UN SEUL UNIVERS
 *
 * Chaque fonction de ce fichier prend l'univers analysé et ne regarde que
 * lui. Sans cela, un classement unique verrait le gospel et la variété se
 * disputer les mêmes places, et l'univers le moins fourni des deux
 * n'apparaîtrait jamais dans les sélections — précisément l'inverse de ce
 * que la séparation cherche à obtenir.
 */

/** Écoutes retenues d'un même compte sur un même titre, par semaine. */
const PLAFOND_PAR_AUDITEUR = 10;
/** Écoutes anonymes retenues sur un même titre, par semaine. */
const PLAFOND_ANONYME = 60;
/** Une écoute abandonnée en route compte, mais peu : c'est un survol. */
const POIDS_INCOMPLETE = 0.3;
/** Vivier maximal : au-delà, on trie du bruit. */
const TITRES_MAX = 500;

export type MesureTitre = {
  song: string;
  /** Lectures brutes, plafonnements compris. */
  ecoutes: number;
  /** Lectures allées au bout. */
  complets: number;
  /** Comptes distincts. Les écoutes anonymes n'y figurent pas. */
  auditeurs: number;
  /** Écoutes pondérées, plafonnées : la valeur qui sert à classer. */
  score: number;
};

/**
 * Écoutes d'une période, par titre.
 *
 * Le premier regroupement est fait par (titre, compte) : c'est là que le
 * plafond s'applique, et il ne peut pas s'appliquer ailleurs — une fois
 * les écoutes additionnées par titre, on ne sait plus qui les a lancées.
 */
export async function mesurerEcoutes(from: Date, to: Date, univers: Univers): Promise<Map<string, MesureTitre>> {
  await connectDB();

  const lignes = await Play.aggregate<{
    _id: Types.ObjectId;
    ecoutes: number;
    complets: number;
    auditeurs: number;
    score: number;
  }>([
    { $match: { playedAt: { $gte: from, $lt: to }, univers } },
    {
      $group: {
        _id: { song: "$song", user: "$user" },
        brut: { $sum: 1 },
        complets: { $sum: { $cond: ["$completed", 1, 0] } },
      },
    },
    {
      $addFields: {
        // Le plafond s'applique au total du couple, puis on répartit en
        // gardant la proportion d'écoutes complètes : plafonner les
        // complètes et les partielles séparément permettrait de dépasser
        // le plafond en alternant les deux.
        plafond: {
          $cond: [{ $eq: ["$_id.user", null] }, PLAFOND_ANONYME, PLAFOND_PAR_AUDITEUR],
        },
      },
    },
    {
      $addFields: {
        retenues: { $min: ["$brut", "$plafond"] },
      },
    },
    {
      $addFields: {
        // Règle de trois sur la part complétée, bornée à `retenues`.
        completsRetenus: {
          $min: [
            "$retenues",
            {
              $round: [
                { $multiply: ["$retenues", { $divide: ["$complets", { $max: ["$brut", 1] }] }] },
                0,
              ],
            },
          ],
        },
      },
    },
    {
      $group: {
        _id: "$_id.song",
        ecoutes: { $sum: "$retenues" },
        complets: { $sum: "$completsRetenus" },
        auditeurs: { $sum: { $cond: [{ $eq: ["$_id.user", null] }, 0, 1] } },
        score: {
          $sum: {
            $add: [
              "$completsRetenus",
              { $multiply: [{ $subtract: ["$retenues", "$completsRetenus"] }, POIDS_INCOMPLETE] },
            ],
          },
        },
      },
    },
    { $sort: { score: -1 } },
    { $limit: TITRES_MAX },
  ]);

  return new Map(
    lignes.map((l) => [
      l._id.toString(),
      {
        song: l._id.toString(),
        ecoutes: l.ecoutes,
        complets: l.complets,
        auditeurs: l.auditeurs,
        score: Math.round(l.score * 10) / 10,
      },
    ])
  );
}

/** Nombre total d'écoutes et d'auditeurs distincts sur la période. */
export async function volumeEcoutes(
  from: Date,
  to: Date,
  univers: Univers
): Promise<{ ecoutes: number; auditeurs: number }> {
  await connectDB();
  const [ligne] = await Play.aggregate<{ ecoutes: number; auditeurs: string[] }>([
    { $match: { playedAt: { $gte: from, $lt: to }, univers } },
    { $group: { _id: null, ecoutes: { $sum: 1 }, auditeurs: { $addToSet: "$user" } } },
  ]);
  if (!ligne) return { ecoutes: 0, auditeurs: 0 };
  return {
    ecoutes: ligne.ecoutes,
    // `$addToSet` range toutes les écoutes anonymes sous une seule
    // valeur nulle : on la retire plutôt que de la compter comme un
    // auditeur.
    auditeurs: ligne.auditeurs.filter((a) => a !== null && a !== undefined).length,
  };
}

/** Un titre publié, avec ce qu'il faut pour le trier et l'expliquer. */
export type TitreCandidat = {
  id: string;
  titre: string;
  artiste: string;
  artisteId: string;
  genre: string;
  langue: string;
  /** Tempo déclaré, absent sur une bonne part du catalogue. Sert à la recette « Adoration ». */
  bpm?: number;
  tags: string[];
  /** Pochette du titre : celle du premier sert de pochette à la playlist. */
  pochette: string;
  sortiLe: Date;
  ecoutesTotales: number;
  likesTotaux: number;
};

/**
 * Le catalogue publié, sous une forme légère.
 *
 * Chargé en une fois puis parcouru en mémoire : les recettes ont chacune
 * besoin de presque tout le catalogue, et sept requêtes distinctes
 * coûteraient plus que ce seul chargement.
 */
export async function catalogueCandidats(univers: Univers): Promise<Map<string, TitreCandidat>> {
  await connectDB();
  const titres = await Song.find({ status: "published", univers })
    .select("title artist genre language coverUrl releaseDate playsCount likesCount bpm tags")
    .populate("artist", "stageName")
    .lean();

  const map = new Map<string, TitreCandidat>();
  for (const t of titres as unknown as {
    _id: Types.ObjectId;
    title: string;
    artist?: { _id: Types.ObjectId; stageName?: string };
    genre?: string;
    language?: string;
    coverUrl?: string;
    releaseDate: Date;
    playsCount?: number;
    likesCount?: number;
    bpm?: number;
    tags?: string[];
  }[]) {
    // Un titre dont l'artiste a été supprimé ne peut ni s'afficher ni
    // s'attribuer : il n'a rien à faire dans une sélection éditoriale.
    if (!t.artist?._id) continue;
    map.set(t._id.toString(), {
      id: t._id.toString(),
      titre: t.title,
      artiste: t.artist.stageName ?? "",
      artisteId: t.artist._id.toString(),
      genre: t.genre ?? "",
      langue: t.language ?? "",
      bpm: t.bpm,
      tags: t.tags ?? [],
      pochette: t.coverUrl ?? "",
      sortiLe: t.releaseDate,
      ecoutesTotales: t.playsCount ?? 0,
      likesTotaux: t.likesCount ?? 0,
    });
  }
  return map;
}

const MOTS_MALGACHE = ["mg", "mlg", "malagasy", "malgache"];

/** Vrai si la langue déclarée du titre est le malgache. */
export function estMalgache(langue: string): boolean {
  const cle = normaliser(langue);
  return cle.length > 0 && MOTS_MALGACHE.includes(cle);
}

export type TermeResolu = {
  terme: string;
  libelle: string;
  recherches: number;
  /** Titres que cette saisie fait remonter, du plus pertinent au moins. */
  titres: string[];
};

/**
 * Ce que le public a cherché, traduit en titres.
 *
 * La résolution se fait ici, au moment de l'analyse, et non au moment où
 * la recherche est saisie : le catalogue d'aujourd'hui est celui qui
 * compte. Un titre publié mercredi doit pouvoir répondre aux recherches
 * de lundi — l'inverse ferait disparaître du classement précisément ce
 * que les gens ne trouvaient pas encore.
 */
export async function resoudreRecherches(
  from: Date,
  to: Date,
  univers: Univers,
  { termesMax = 40, titresParTerme = 3 } = {}
): Promise<TermeResolu[]> {
  const termes = await termesLesPlusCherches(from, to, termesMax);
  const resolus: TermeResolu[] = [];

  for (const t of termes) {
    try {
      const resultat = await rechercheGlobale({
        q: t.libelle,
        type: "songs",
        page: 1,
        // La recherche hiérarchise sans exclure : on lit plus large que
        // nécessaire, puis on ne retient que les titres de l'univers
        // analysé, filtrés contre le catalogue quelques lignes plus bas.
        limit: titresParTerme * 3,
        sort: "relevance",
        univers,
      });
      const section = resultat.sections.find((s) => s.kind === "song");
      const titres = ((section?.items ?? []) as { _id?: unknown }[])
        .map((i) => String(i._id ?? ""))
        .filter(Boolean);
      // Une saisie qui ne remonte rien n'est pas une erreur : elle dit
      // qu'on cherche ici quelque chose qui n'y est pas. Utile à
      // l'exploitant, sans emploi pour une playlist.
      if (titres.length > 0) resolus.push({ ...t, recherches: t.total, titres });
    } catch (err) {
      console.error(`[curation] résolution impossible pour « ${t.libelle} »`, err);
    }
  }

  return resolus;
}

export type Signaux = {
  fenetre: Fenetre;
  /** Univers analysé. Toutes les mesures qui suivent ne portent que sur lui. */
  univers: Univers;
  /** Mesures de la semaine analysée. */
  semaine: Map<string, MesureTitre>;
  /** Mesures des sept jours précédents, pour la progression. */
  precedente: Map<string, MesureTitre>;
  catalogue: Map<string, TitreCandidat>;
  recherches: TermeResolu[];
  volumeRecherches: number;
  ecoutes: number;
  auditeurs: number;
};

/** Rassemble tout ce que les recettes auront à consulter. */
export async function collecterSignaux(fenetre: Fenetre, univers: Univers): Promise<Signaux> {
  const [semaine, precedente, catalogue, recherches, volumes, nbRecherches] = await Promise.all([
    mesurerEcoutes(fenetre.from, fenetre.to, univers),
    mesurerEcoutes(fenetre.precedenteFrom, fenetre.precedenteTo, univers),
    catalogueCandidats(univers),
    resoudreRecherches(fenetre.from, fenetre.to, univers),
    volumeEcoutes(fenetre.from, fenetre.to, univers),
    // Le volume de recherches n'est pas ventilé par univers : le journal
    // enregistre une saisie, pas le répertoire de celui qui l'a tapée.
    // C'est un indicateur d'activité affiché tel quel, il ne décide rien.
    volumeRecherches(fenetre.from, fenetre.to),
  ]);

  return {
    fenetre,
    univers,
    semaine,
    precedente,
    catalogue,
    recherches,
    volumeRecherches: nbRecherches,
    ecoutes: volumes.ecoutes,
    auditeurs: volumes.auditeurs,
  };
}
