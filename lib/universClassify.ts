import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import Artist from "@/models/Artist";
import Album from "@/models/Album";
import Playlist from "@/models/Playlist";
import { detecterUnivers, resumerVerdict, type Verdict } from "@/lib/universDetection";
import { arbitrerUnivers, PAR_LOT, type ATrancher } from "@/lib/ai/universLabel";
import { etatIA } from "@/lib/ai/client";
import { UNIVERS_PAR_DEFAUT, UNIVERS, type Univers } from "@/lib/univers";
import { rattraperUnivers, resynchroniserEcoutes } from "@/lib/universBackfill";

/**
 * Ranger le catalogue dans ses deux univers, et l'y maintenir.
 *
 * L'ARTISTE DÉCIDE, LE TITRE SUIT
 *
 * Un artiste évangélique reste un artiste évangélique : ses titres
 * naissent dans son univers et l'y restent. C'est la règle demandée, et
 * c'est aussi la seule qui tienne à l'usage — un catalogue où chaque
 * morceau serait classé indépendamment finirait par disperser la
 * discographie d'un même chanteur des deux côtés de la frontière, et
 * l'auditeur qui le suit ne comprendrait pas pourquoi la moitié de son
 * œuvre a disparu.
 *
 * L'exception est explicite : un admin peut déplacer un titre seul. Ce
 * titre porte alors `universSource: "admin"`, et plus aucune cascade ne
 * le touche. C'est ce qui permet de traiter le cas réel — le morceau de
 * gospel d'un artiste de variété — sans que la règle générale ait à
 * plier.
 *
 * TROIS SOURCES DE CLASSEMENT, QUI NE SE VALENT PAS
 *
 * `admin` gagne toujours : c'est une décision humaine, rien ne l'écrase.
 * `auto` vient de la détection. `artiste` est l'héritage, et c'est le
 * seul que la cascade réécrit.
 */

/** Part de titres évangéliques au-delà de laquelle une playlist bascule. */
const SEUIL_PLAYLIST = 0.6;

export type ResultatClassement = {
  artistes: number;
  titres: number;
  albums: number;
  /** Cas soumis au modèle faute d'indice suffisant. */
  arbitres: number;
  /** Écoutes remises en phase avec l'univers de leur titre. */
  ecoutes: number;
};

/* ------------------------------------------------------------- cascade -- */

/**
 * Propage l'univers d'un artiste à ce qui lui appartient.
 *
 * Les titres déplacés à la main sont épargnés — c'est précisément ce que
 * `universSource` distingue. Les albums, eux, suivent toujours : un
 * album appartient entièrement à son auteur, et le scinder n'aurait pas
 * de sens.
 */
export async function cascaderArtiste(artistId: Types.ObjectId | string, univers: Univers): Promise<number> {
  const [titres] = await Promise.all([
    Song.updateMany(
      { artist: artistId, universSource: { $ne: "admin" } },
      { $set: { univers, universSource: "artiste" } }
    ),
    Album.updateMany({ artist: artistId }, { $set: { univers } }),
  ]);
  return titres.modifiedCount ?? 0;
}

/** Classe un artiste et fait suivre son catalogue. */
export async function classerArtiste(
  artistId: Types.ObjectId | string,
  { univers, source, motif }: { univers: Univers; source: "auto" | "admin"; motif?: string }
): Promise<number> {
  await connectDB();
  await Artist.updateOne(
    { _id: artistId },
    { $set: { univers, universSource: source, universMotif: motif ?? "" } }
  );
  return cascaderArtiste(artistId, univers);
}

/** Déplace un seul titre, en le soustrayant définitivement à la cascade. */
export async function classerTitre(
  songId: Types.ObjectId | string,
  { univers, source }: { univers: Univers; source: "auto" | "admin" }
): Promise<void> {
  await connectDB();
  await Song.updateOne({ _id: songId }, { $set: { univers, universSource: source } });
}

/* ---------------------------------------------------------- à l'écriture -- */

/**
 * L'univers d'un titre qu'on vient de publier.
 *
 * Il hérite de son artiste, sauf si ses propres données le rangent
 * franchement ailleurs — un titre de gospel publié par un artiste de
 * variété, cas assez courant pour mériter d'être vu tout de suite plutôt
 * qu'attendre la prochaine passe de détection.
 */
export function universALaPublication(
  universArtiste: Univers,
  champs: { titre?: string; genre?: string; tags?: string[]; paroles?: string; description?: string }
): { univers: Univers; source: "artiste" | "auto" } {
  if (universArtiste === "christian") return { univers: "christian", source: "artiste" };

  // Le seuil vit dans lib/universDetection.ts : le redoubler ici ferait
  // deux règles qui finiraient par diverger.
  const verdict = detecterUnivers(champs);
  if (verdict.univers === "christian") return { univers: "christian", source: "auto" };
  return { univers: universArtiste, source: "artiste" };
}

/**
 * Recalcule l'univers d'une playlist de membre à partir de ses titres.
 *
 * Une playlist n'a pas d'auteur au sens musical : c'est son contenu qui
 * la situe. Le seuil est haut — 60 % — parce qu'une playlist de variété
 * contenant deux gospels reste une playlist de variété, tandis qu'une
 * playlist de louange avec deux titres profanes reste une playlist de
 * louange.
 *
 * Les sélections produites par la curation sont ignorées : leur univers
 * est celui de l'analyse qui les a faites, et il ne se déduit pas.
 */
export async function recalculerUniversPlaylist(playlistId: Types.ObjectId | string): Promise<Univers | null> {
  await connectDB();
  const playlist = await Playlist.findById(playlistId).select("songs auto univers");
  if (!playlist || playlist.auto) return null;

  const ids = playlist.songs ?? [];
  if (ids.length === 0) return playlist.univers;

  const titres = await Song.find({ _id: { $in: ids } }).select("univers").lean();
  if (titres.length === 0) return playlist.univers;

  const chretiens = titres.filter((t) => (t as { univers?: string }).univers === "christian").length;
  const univers: Univers = chretiens / titres.length >= SEUIL_PLAYLIST ? "christian" : "general";

  if (univers !== playlist.univers) {
    await Playlist.updateOne({ _id: playlist._id }, { $set: { univers } });
  }
  return univers;
}

/* ------------------------------------------------------------ détection -- */

type ArtistePourDetection = {
  _id: Types.ObjectId;
  stageName: string;
  bio?: string;
  genres?: string[];
  univers?: Univers;
  universSource?: "auto" | "admin";
};

/**
 * Ce qu'on retient d'un titre après l'avoir lu : un verdict, pas un texte.
 *
 * C'est la raison d'être de ce type. Charger le catalogue entier avec ses
 * paroles pour classer les artistes ferait tenir plusieurs dizaines de
 * mégaoctets en mémoire sur une instance qui n'en a pas — et cela pour
 * une donnée dont on ne garde, au bout du compte, qu'un booléen. Les
 * paroles sont donc lues au fil du curseur, jugées, puis relâchées.
 */
type ResumeTitre = {
  _id: Types.ObjectId;
  title: string;
  artist: Types.ObjectId;
  univers: Univers;
  universSource: string;
  /** Verdict du lexique sur ce titre pris seul. */
  chretien: boolean;
};

/**
 * Le verdict porté sur un artiste : ce que dit son profil, et ce que
 * disent ses titres.
 *
 * Un artiste ne se classe pas sur son seul nom de scène. Ce qui le situe,
 * c'est ce qu'il publie : si les deux tiers de ses titres relèvent du
 * répertoire évangélique, c'est un artiste évangélique, même quand sa
 * biographie est vide — et c'est le cas le plus fréquent, parce que peu
 * d'artistes remplissent leur biographie.
 */
export function verdictArtiste(
  artiste: { stageName: string; bio?: string; genres?: string[] },
  titres: { chretien: boolean }[]
): Verdict {
  const profil = detecterUnivers({
    artiste: artiste.stageName,
    bio: artiste.bio,
    genre: (artiste.genres ?? []).join(" "),
  });
  if (profil.univers === "christian") return profil;
  if (titres.length === 0) return profil;

  const part = titres.filter((t) => t.chretien).length / titres.length;

  // Deux tiers : au-dessous, on est devant un artiste qui a signé un ou
  // deux titres de louange, pas devant un artiste de louange. Ses titres
  // seront classés individuellement, lui restera général.
  if (part >= 2 / 3) {
    return {
      univers: "christian",
      confiance: Math.min(0.6 + part * 0.4, 1),
      indices: [
        ...profil.indices,
        { mot: `${Math.round(part * 100)} % de ses titres`, poids: "fort", champ: "catalogue" },
      ],
      incertain: false,
    };
  }

  // Le profil peut rester incertain : c'est ce qui déclenche l'arbitrage.
  return profil;
}

/**
 * Passe de classement sur tout le catalogue.
 *
 * Ce que la fonction NE fait jamais : toucher à un classement posé par un
 * admin. C'est ce qui rend la relance sans danger — on peut la
 * redéclencher après chaque import sans défaire le travail de personne.
 *
 * `avecIA` n'est honoré que si l'assistance est réellement disponible :
 * clé absente ou plafond atteint, la passe se termine quand même, avec le
 * seul lexique. Une détection qui échoue parce que l'IA dort serait la
 * pire des deux options.
 */
export async function classerCatalogue({
  avecIA = false,
  compte,
}: {
  avecIA?: boolean;
  compte: string;
}): Promise<ResultatClassement> {
  await connectDB();
  // Les documents antérieurs à la séparation n'ont pas de champ du tout :
  // les requêtes ci-dessous les verraient, mais les `updateMany` filtrés
  // sur `univers: { $ne: ... }` les manqueraient.
  await rattraperUnivers();

  const artistes = (await Artist.find({ universSource: { $ne: "admin" } })
    .select("stageName bio genres univers universSource")
    .lean()) as unknown as ArtistePourDetection[];

  // Lecture au curseur : chaque titre est jugé puis oublié. Voir
  // `ResumeTitre` pour ce que cela évite.
  const parArtiste = new Map<string, ResumeTitre[]>();
  const curseur = Song.find({})
    .select("title artist genre tags lyrics description univers universSource")
    .lean()
    .cursor();

  for await (const brut of curseur) {
    const t = brut as unknown as {
      _id: Types.ObjectId;
      title: string;
      artist?: Types.ObjectId;
      genre?: string;
      tags?: string[];
      lyrics?: string;
      description?: string;
      univers?: Univers;
      universSource?: string;
    };
    if (!t.artist) continue;

    const resume: ResumeTitre = {
      _id: t._id,
      title: t.title,
      artist: t.artist,
      univers: t.univers ?? UNIVERS_PAR_DEFAUT,
      universSource: t.universSource ?? "artiste",
      chretien:
        detecterUnivers({
          titre: t.title,
          genre: t.genre,
          tags: t.tags,
          paroles: t.lyrics,
          description: t.description,
        }).univers === "christian",
    };

    const cle = String(t.artist);
    const liste = parArtiste.get(cle);
    if (liste) liste.push(resume);
    else parArtiste.set(cle, [resume]);
  }

  const decisions = new Map<string, { univers: Univers; motif: string }>();
  const aArbitrer: ATrancher[] = [];

  for (const artiste of artistes) {
    const siens = parArtiste.get(String(artiste._id)) ?? [];
    const verdict = verdictArtiste(artiste, siens);

    if (verdict.incertain && avecIA) {
      aArbitrer.push({
        id: String(artiste._id),
        titre: artiste.stageName,
        genre: (artiste.genres ?? []).join(", "),
        extrait: [artiste.bio ?? "", siens.slice(0, 5).map((t) => t.title).join(" · ")]
          .filter(Boolean)
          .join("\n"),
      });
      continue;
    }

    decisions.set(String(artiste._id), { univers: verdict.univers, motif: resumerVerdict(verdict) });
  }

  let arbitres = 0;
  if (aArbitrer.length > 0 && (await etatIA("univers")).disponible) {
    for (let i = 0; i < aArbitrer.length; i += PAR_LOT) {
      const lot = aArbitrer.slice(i, i + PAR_LOT);
      try {
        const verdicts = await arbitrerUnivers(lot, { compte });
        for (const v of verdicts) {
          decisions.set(v.id, { univers: v.univers, motif: `Arbitrage IA : ${v.motif}` });
          arbitres += 1;
        }
      } catch (err) {
        // Un lot qui échoue ne doit pas emporter la passe : les artistes
        // concernés restent simplement dans leur univers actuel.
        console.error("[univers] arbitrage IA impossible pour un lot", err);
        break;
      }
    }
  }

  // Ce qui n'a pas été arbitré retombe sur le lexique plutôt que de
  // rester sans décision : un artiste non classé serait invisible dans
  // les deux univers.
  for (const entree of aArbitrer) {
    if (decisions.has(entree.id)) continue;
    const artiste = artistes.find((a) => String(a._id) === entree.id);
    if (!artiste) continue;
    const verdict = verdictArtiste(artiste, parArtiste.get(entree.id) ?? []);
    decisions.set(entree.id, { univers: verdict.univers, motif: resumerVerdict(verdict) });
  }

  // Les écritures se font par lot, et non artiste par artiste : un
  // catalogue de quelques centaines d'artistes produirait sinon plus de
  // mille aller-retours, dont l'écran d'administration attendrait la fin.
  let artistesChanges = 0;
  let titresChanges = 0;
  let albumsChanges = 0;

  const parDecision: Record<Univers, Types.ObjectId[]> = { general: [], christian: [] };
  const motifs: { id: Types.ObjectId; motif: string }[] = [];

  for (const artiste of artistes) {
    const decision = decisions.get(String(artiste._id));
    if (!decision) continue;
    if (decision.univers !== (artiste.univers ?? UNIVERS_PAR_DEFAUT)) artistesChanges += 1;
    parDecision[decision.univers].push(artiste._id);
    motifs.push({ id: artiste._id, motif: decision.motif });
  }

  for (const univers of UNIVERS) {
    const ids = parDecision[univers];
    if (ids.length === 0) continue;

    await Artist.updateMany({ _id: { $in: ids } }, { $set: { univers, universSource: "auto" } });

    const majTitres = await Song.updateMany(
      { artist: { $in: ids }, universSource: { $ne: "admin" }, univers: { $ne: univers } },
      { $set: { univers, universSource: "artiste" } }
    );
    titresChanges += majTitres.modifiedCount ?? 0;

    const majAlbums = await Album.updateMany(
      { artist: { $in: ids }, univers: { $ne: univers } },
      { $set: { univers } }
    );
    albumsChanges += majAlbums.modifiedCount ?? 0;
  }

  // Le motif diffère d'un artiste à l'autre : c'est la seule écriture qui
  // ne peut pas se grouper, et elle part en une seule commande.
  if (motifs.length > 0) {
    await Artist.bulkWrite(
      motifs.map((m) => ({
        updateOne: { filter: { _id: m.id }, update: { $set: { universMotif: m.motif } } },
      }))
    );
  }

  // Les titres d'un artiste général qui relèvent seuls du répertoire
  // évangélique : reconnus individuellement, marqués `auto` pour que la
  // cascade ne les reprenne pas au passage suivant.
  const generaux = new Set(parDecision.general.map(String));
  const isoles: Types.ObjectId[] = [];
  for (const [artiste, titres] of parArtiste) {
    if (!generaux.has(artiste)) continue;
    for (const t of titres) {
      if (t.universSource === "admin" || !t.chretien) continue;
      isoles.push(t._id);
    }
  }
  if (isoles.length > 0) {
    const maj = await Song.updateMany(
      { _id: { $in: isoles }, univers: { $ne: "christian" } },
      { $set: { univers: "christian", universSource: "auto" } }
    );
    titresChanges += maj.modifiedCount ?? 0;
  }

  await recalculerToutesLesPlaylists();

  // L'historique suit les titres qui ont changé de bord : sans cela, le
  // profil de goûts d'un auditeur continuerait de compter ses écoutes de
  // louange dans l'univers général.
  let ecoutes = 0;
  for (const u of UNIVERS) ecoutes += await resynchroniserEcoutes(u);

  return { artistes: artistesChanges, titres: titresChanges, albums: albumsChanges, arbitres, ecoutes };
}

/**
 * Remet à jour l'univers de toutes les playlists de membres.
 *
 * Appelée après une passe de classement : les titres ont bougé, les
 * playlists qui les contiennent aussi. Deux agrégations suffisent — une
 * par univers cible — plutôt qu'une lecture playlist par playlist.
 */
export async function recalculerToutesLesPlaylists(): Promise<number> {
  await connectDB();

  const lignes = await Playlist.aggregate<{ _id: Types.ObjectId; univers: Univers; part: number }>([
    { $match: { auto: { $exists: false }, songs: { $ne: [] } } },
    { $project: { univers: 1, songs: 1 } },
    { $lookup: { from: "songs", localField: "songs", foreignField: "_id", as: "titres" } },
    {
      $project: {
        univers: 1,
        part: {
          $cond: [
            { $eq: [{ $size: "$titres" }, 0] },
            0,
            {
              $divide: [
                {
                  $size: {
                    $filter: { input: "$titres", as: "t", cond: { $eq: ["$$t.univers", "christian"] } },
                  },
                },
                { $size: "$titres" },
              ],
            },
          ],
        },
      },
    },
  ]);

  const versChretien: Types.ObjectId[] = [];
  const versGeneral: Types.ObjectId[] = [];
  for (const l of lignes) {
    const voulu: Univers = l.part >= SEUIL_PLAYLIST ? "christian" : "general";
    if (voulu === l.univers) continue;
    (voulu === "christian" ? versChretien : versGeneral).push(l._id);
  }

  const [a, b] = await Promise.all([
    versChretien.length
      ? Playlist.updateMany({ _id: { $in: versChretien } }, { $set: { univers: "christian" } })
      : Promise.resolve({ modifiedCount: 0 }),
    versGeneral.length
      ? Playlist.updateMany({ _id: { $in: versGeneral } }, { $set: { univers: "general" } })
      : Promise.resolve({ modifiedCount: 0 }),
  ]);

  return (a.modifiedCount ?? 0) + (b.modifiedCount ?? 0);
}
