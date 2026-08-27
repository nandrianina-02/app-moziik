import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import { DESCRIPTION_MOMENTS, type Moment } from "@/lib/taste/context";
import { familleDuMotif, type Famille, type Motif } from "@/lib/taste/motifs";
import { artistesPreferes, genresPreferes, profilVide, type ProfilGouts } from "@/lib/taste/profile";

/**
 * La station personnalisée : une file sans fin, bâtie pour un auditeur.
 *
 * C'est le même moteur qui sert de radio personnalisée, de « DJ » et de
 * mix : ces trois mots désignent la même chose — une suite de morceaux
 * choisie pour quelqu'un et ordonnée pour s'écouter d'affilée. En faire
 * trois moteurs aurait produit trois fois le même code avec trois
 * réglages qui divergent.
 *
 * TROIS FAMILLES, ET POURQUOI PAS UNE SEULE
 *
 * Une station qui ne passe que du connu n'apprend rien à personne et
 * lasse au bout d'un quart d'heure. Une station qui ne passe que de
 * l'inconnu se fait couper au troisième titre. Le dosage compte donc
 * autant que la sélection : du familier pour rester chez soi, du voisin
 * pour avancer, de la découverte pour être surpris.
 *
 * L'ORDRE EST UNE DÉCISION, PAS UN HASARD
 *
 * Les trois familles sont entrelacées, et deux titres du même artiste ne
 * se suivent jamais. Une file triée par pertinence enchaînerait cinq
 * morceaux du même artiste puis basculerait d'un coup dans l'inconnu :
 * ce serait la meilleure sélection possible dans le pire ordre possible.
 *
 * CE QUE LE MODÈLE NE FAIT PAS ICI
 *
 * Choisir les titres. Il nomme la station et l'introduit
 * (lib/ai/dj.ts) ; la sélection et l'ordre sont calculés. Une file
 * produite par un modèle serait impossible à expliquer titre par titre,
 * et c'est précisément ce que `motif` garantit.
 */

/** Composition visée d'une file. La somme fait 1. */
const DOSAGE: Record<Famille, number> = {
  familier: 0.4,
  voisin: 0.4,
  decouverte: 0.2,
};

/** Titres servis par tour. Environ une heure d'écoute. */
export const PAR_TOUR = 20;
/** Vivier tiré de la base pour chaque famille avant sélection. */
const VIVIER = 60;
/**
 * Titres d'un même artiste, au maximum, dans un tour.
 *
 * Trois sur vingt : assez pour qu'un auditeur retrouve celui qu'il écoute
 * tous les jours, trop peu pour que la station se réduise à lui. Le
 * plafond cède avant l'espacement quand le catalogue ne suffit pas à
 * remplir la file.
 */
const MAX_PAR_ARTISTE = 3;

export type TitreDeStation = {
  song: Record<string, unknown>;
  motif: Motif;
};

const CHAMPS = "title coverUrl audioUrl duration genre language bpm releaseDate artist album playsCount";

/** Les titres jouables correspondant à un filtre, peuplés pour le lecteur. */
async function chercher(filtre: Record<string, unknown>, limite: number, tri: Record<string, 1 | -1>) {
  return Song.find({ status: "published", ...filtre })
    .select(CHAMPS)
    .populate("artist", "stageName verified")
    .populate("album", "title")
    .sort(tri)
    .limit(limite)
    .lean();
}

function identifiants(ids: Iterable<string>): Types.ObjectId[] {
  const sortie: Types.ObjectId[] = [];
  for (const id of ids) {
    // Un identifiant illisible ferait échouer toute la requête plutôt que
    // d'être ignoré : l'historique peut contenir n'importe quoi.
    if (Types.ObjectId.isValid(id)) sortie.push(new Types.ObjectId(id));
  }
  return sortie;
}

/**
 * Départage deux titres également plausibles selon le moment.
 *
 * Un titre sans `bpm` obtient 0 : ni bonus ni malus. La moitié du
 * catalogue n'a pas cette donnée, et la pénaliser reviendrait à ne
 * proposer que les morceaux dont la fiche est bien remplie.
 */
function bonusDuMoment(bpm: number | undefined, moment: Moment): number {
  if (!bpm || bpm <= 0) return 0;
  const { min, max } = DESCRIPTION_MOMENTS[moment].bpm;
  if (bpm >= min && bpm <= max) return 1;
  const ecart = bpm < min ? min - bpm : bpm - max;
  // Au-delà de 40 bpm d'écart, le malus cesse de croître : un morceau
  // très lent le soir n'est pas trois fois pire qu'un morceau un peu
  // lent, il est simplement moins indiqué.
  return -Math.min(ecart / 40, 1);
}

type Candidat = { song: Record<string, unknown>; motif: Motif; score: number };

function idDe(song: Record<string, unknown>): string {
  return String((song as { _id: unknown })._id);
}

function artisteDe(song: Record<string, unknown>): string {
  const a = (song as { artist?: { _id?: unknown } | null }).artist;
  return a?._id ? String(a._id) : "";
}

function nomArtiste(song: Record<string, unknown>): string {
  const a = (song as { artist?: { stageName?: string } | null }).artist;
  return a?.stageName ?? "";
}

/* ------------------------------------------------------------ familles -- */

/** Ce qu'il connaît : ses favoris et ce qu'il réécoute. */
async function familier(profil: ProfilGouts, exclus: Set<string>, moment: Moment): Promise<Candidat[]> {
  const connus = [...profil.connus.entries()]
    .filter(([id]) => !exclus.has(id) && !profil.refuses.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, VIVIER)
    .map(([id]) => id);

  const ids = identifiants([...profil.favoris, ...connus].filter((id) => !exclus.has(id)));
  if (ids.length === 0) return [];

  const titres = await chercher({ _id: { $in: ids } }, VIVIER, { playsCount: -1 });

  return titres.map((s) => {
    const song = s as unknown as Record<string, unknown>;
    const id = idDe(song);
    const fois = profil.connus.get(id) ?? 0;
    const motif: Motif = profil.favoris.has(id)
      ? { type: "favori" }
      : { type: "deja_ecoute", fois };
    return {
      song,
      motif,
      score: (profil.favoris.has(id) ? 3 : 1) + fois * 0.2 + bonusDuMoment(song.bpm as number, moment),
    };
  });
}

/** Le voisinage : ses artistes et ses genres, mais des titres qu'il n'a pas entendus. */
async function voisin(profil: ProfilGouts, exclus: Set<string>, moment: Moment): Promise<Candidat[]> {
  const artistes = identifiants(artistesPreferes(profil, 10));
  const genres = genresPreferes(profil, 4);
  if (artistes.length === 0 && genres.length === 0) return [];

  const dejaVus = identifiants([...profil.connus.keys(), ...exclus, ...profil.refuses]);
  const criteres: Record<string, unknown>[] = [];
  if (artistes.length) criteres.push({ artist: { $in: artistes } });
  if (genres.length) criteres.push({ genre: { $in: genres } });

  const titres = await chercher(
    { $or: criteres, _id: { $nin: dejaVus } },
    VIVIER,
    { playsCount: -1 }
  );

  const poidsGenre = new Map(profil.genres.map((g) => [g.cle, g.poids]));
  const poidsArtiste = new Map(profil.artistes.map((a) => [a.cle, a.poids]));
  const maxArtiste = Math.max(...[...poidsArtiste.values(), 1]);
  const maxGenre = Math.max(...[...poidsGenre.values(), 1]);

  return titres.map((s) => {
    const song = s as unknown as Record<string, unknown>;
    const artisteId = artisteDe(song);
    const genre = String(song.genre ?? "");
    const affiniteArtiste = (poidsArtiste.get(artisteId) ?? 0) / maxArtiste;
    const affiniteGenre = (poidsGenre.get(genre) ?? 0) / maxGenre;

    const motif: Motif =
      affiniteArtiste > 0
        ? { type: "artiste_aime", artiste: nomArtiste(song) }
        : { type: "genre_habituel", genre };

    return {
      song,
      motif,
      score: affiniteArtiste * 2 + affiniteGenre + bonusDuMoment(song.bpm as number, moment) * 0.5,
    };
  });
}

/**
 * Ce qu'il n'écoute pas — encore.
 *
 * Volontairement pris HORS de ses genres habituels : une « découverte »
 * dans le genre qu'il écoute déjà n'est pas une découverte, c'est du
 * voisinage. On s'appuie sur ce que le reste du public écoute, seul
 * garde-fou disponible contre la proposition purement arbitraire.
 */
async function decouverte(profil: ProfilGouts, exclus: Set<string>, moment: Moment): Promise<Candidat[]> {
  const siens = genresPreferes(profil, 4);
  const dejaVus = identifiants([...profil.connus.keys(), ...exclus, ...profil.refuses]);

  const filtre: Record<string, unknown> = { _id: { $nin: dejaVus } };
  if (siens.length > 0) filtre.genre = { $nin: siens };

  const titres = await chercher(filtre, VIVIER, { playsCount: -1 });

  return titres.map((s) => {
    const song = s as unknown as Record<string, unknown>;
    const motif: Motif = profil.assezDeDonnees
      ? { type: "decouverte", genre: String(song.genre ?? "") }
      : { type: "populaire" };
    return {
      song,
      motif,
      score: Math.log10((song.playsCount as number) + 10) + bonusDuMoment(song.bpm as number, moment) * 0.5,
    };
  });
}

/* -------------------------------------------------------------- montage -- */

/**
 * Entrelace les familles et espace les artistes.
 *
 * On sert la famille la plus « en retard » sur son quota, en sautant tout
 * candidat dont l'artiste vient de passer. C'est ce qui fait la
 * différence entre une sélection et un mix.
 *
 * DEUX CONTRAINTES, QUI NE SE VALENT PAS
 *
 * L'espacement des artistes et le plafond par artiste ne pèsent pas
 * pareil. Entendre deux fois le même artiste à la suite s'entend
 * immédiatement ; en entendre quatre titres répartis sur une heure ne
 * se remarque pas — et c'est même attendu quand on l'écoute tous les
 * jours.
 *
 * Un relâchement en bloc les traitait à égalité : dès qu'une famille
 * n'avait plus de candidat conforme, les deux tombaient ensemble. Sur un
 * auditeur au goût très marqué — le cas le plus courant — la pile
 * « familier » ne contient qu'un artiste, le relâchement se déclenchait
 * à chaque tour, et la file finissait avec six titres du même artiste
 * dont deux consécutifs. Les contraintes sont donc levées une par une,
 * dans l'ordre de ce qui s'entend le moins.
 */
function monter(parFamille: Record<Famille, Candidat[]>, total: number): TitreDeStation[] {
  const restants: Record<Famille, Candidat[]> = {
    familier: [...parFamille.familier].sort((a, b) => b.score - a.score),
    voisin: [...parFamille.voisin].sort((a, b) => b.score - a.score),
    decouverte: [...parFamille.decouverte].sort((a, b) => b.score - a.score),
  };

  const servis: Record<Famille, number> = { familier: 0, voisin: 0, decouverte: 0 };
  const parArtiste = new Map<string, number>();
  const vus = new Set<string>();
  const file: TitreDeStation[] = [];
  let dernierArtiste = "";

  const FAMILLES: Famille[] = ["familier", "voisin", "decouverte"];

  /** Les familles ayant encore quelque chose à offrir, la plus en retard d'abord. */
  function parPriorite(): Famille[] {
    const retard = (f: Famille) => DOSAGE[f] - servis[f] / Math.max(file.length, 1);
    return FAMILLES.filter((f) => restants[f].length > 0).sort((a, b) => retard(b) - retard(a));
  }

  /** Premier candidat d'une pile satisfaisant `accepte`. */
  function chercherDans(famille: Famille, accepte: (c: Candidat) => boolean): number {
    return restants[famille].findIndex((c) => !vus.has(idDe(c.song)) && accepte(c));
  }

  const inedit = () => true;
  const pasColle = (c: Candidat) => artisteDe(c.song) !== dernierArtiste;
  const sousPlafond = (c: Candidat) => (parArtiste.get(artisteDe(c.song)) ?? 0) < MAX_PAR_ARTISTE;

  while (file.length < total) {
    const familles = parPriorite();
    if (familles.length === 0) break;

    // Du plus exigeant au moins exigeant. L'adjacence tombe en dernier :
    // c'est la contrainte qui s'entend.
    const essais: ((c: Candidat) => boolean)[] = [
      (c) => pasColle(c) && sousPlafond(c),
      pasColle,
      inedit,
    ];

    let famille: Famille | null = null;
    let indice = -1;
    for (const accepte of essais) {
      for (const f of familles) {
        const trouve = chercherDans(f, accepte);
        if (trouve !== -1) {
          famille = f;
          indice = trouve;
          break;
        }
      }
      if (famille) break;
    }

    if (!famille || indice === -1) break;

    const [choisi] = restants[famille].splice(indice, 1);
    const artiste = artisteDe(choisi.song);
    vus.add(idDe(choisi.song));
    parArtiste.set(artiste, (parArtiste.get(artiste) ?? 0) + 1);
    dernierArtiste = artiste;
    servis[famille] += 1;
    file.push({ song: choisi.song, motif: choisi.motif });
  }

  return file;
}

export type Station = {
  titres: TitreDeStation[];
  /** Faux quand l'historique ne permettait aucune personnalisation. */
  personnalisee: boolean;
  moment: Moment;
};

/**
 * Construit un tour de station.
 *
 * `exclus` porte ce que l'auditeur a déjà dans sa file : c'est ce qui
 * permet de rappeler cette fonction indéfiniment sans jamais resservir le
 * même morceau.
 */
export async function construireStation({
  profil,
  moment,
  exclus = new Set<string>(),
  taille = PAR_TOUR,
}: {
  profil: ProfilGouts;
  moment: Moment;
  exclus?: Set<string>;
  taille?: number;
}): Promise<Station> {
  await connectDB();

  // Sans historique, les trois familles se réduisent à une seule : ce que
  // le public écoute. Le dire plutôt que d'habiller du populaire en
  // « choisi pour vous ».
  if (!profil.assezDeDonnees) {
    const populaires = await decouverte(profilVide(), exclus, moment);
    return {
      titres: monter({ familier: [], voisin: [], decouverte: populaires }, taille),
      personnalisee: false,
      moment,
    };
  }

  const [f, v, d] = await Promise.all([
    familier(profil, exclus, moment),
    voisin(profil, exclus, moment),
    decouverte(profil, exclus, moment),
  ]);

  const titres = monter({ familier: f, voisin: v, decouverte: d }, taille);

  return { titres, personnalisee: titres.some((t) => familleDuMotif(t.motif) !== "decouverte"), moment };
}
