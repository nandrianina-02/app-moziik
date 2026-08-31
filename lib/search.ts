import Album from "@/models/Album";
import Artist from "@/models/Artist";
import Event from "@/models/Event";
import Playlist from "@/models/Playlist";
import Song from "@/models/Song";
import User from "@/models/User";
import { motsDe, normaliser, regexMot, regexMotAncre, ressemblance } from "@/lib/searchText";
import type { Univers } from "@/lib/univers";

/**
 * Recherche globale de Moziik.
 *
 * Trois idées structurent ce fichier.
 *
 * 1. **La recherche part des relations, pas du texte.** Le nom d'un
 *    artiste n'apparaît nulle part dans un document Song : il n'y a qu'une
 *    référence. Chercher « Nandrianina » dans le champ `title` ne peut donc
 *    RIEN ramener de ses titres. On résout donc les artistes d'abord, puis
 *    on interroge les titres, albums et évènements par identifiant autant
 *    que par texte. Sans cette première passe, filtrer sur « Titres » après
 *    avoir cherché un artiste renvoyait une page vide — c'était le cas
 *    avant correction, mesuré.
 *
 * 2. **Le classement est calculé en mémoire.** MongoDB sait trier par un
 *    champ ; il ne sait pas exprimer « correspondance exacte d'abord, puis
 *    le titre, puis l'artiste, puis l'album, à popularité et fraîcheur
 *    égales ». On ramène donc un vivier borné — trié par popularité, pour
 *    que la troncature garde ce qui compte — et on le note ici.
 *
 * 3. **Les fautes de frappe demandent un second passage.** Un `$regex` ne
 *    rattrape pas « nandrianna ». Quand la passe directe ne trouve rien, on
 *    reprend un vivier des contenus les plus écoutés et on le note à la
 *    distance d'édition. C'est borné (voir RATTRAPAGE) et n'a lieu que
 *    lorsque la recherche a échoué.
 */

/* ------------------------------------------------------------- types ---- */

export type TypeFiltre =
  | "all"
  | "songs"
  | "artists"
  | "albums"
  | "playlists"
  | "events"
  | "genres"
  | "users";

export type TriRecherche = "relevance" | "popularity" | "date";

export type OptionsRecherche = {
  q: string;
  type: TypeFiltre;
  page: number;
  limit: number;
  sort: TriRecherche;
  genre?: string;
  artistId?: string;
  albumId?: string;
  /**
   * Univers de l'auditeur. Il hiérarchise les résultats, il ne les coupe
   * pas — voir FACTEUR_AUTRE_UNIVERS.
   */
  univers?: Univers;
};

export type KindResultat = "song" | "artist" | "album" | "playlist" | "event" | "user" | "genre";

export type Section = {
  key: string;
  title: string;
  kind: KindResultat;
  items: Record<string, unknown>[];
  total: number;
  /** Filtre à activer pour « Voir tout ». Absent = section non paginable. */
  voirTout?: TypeFiltre;
  disposition: "liste" | "grille" | "carrousel";
  /** Vrai si le vivier a été atteint : le total affiché est un plancher. */
  tronque?: boolean;
};

export type ResultatRecherche = {
  q: string;
  type: TypeFiltre;
  page: number;
  limit: number;
  /** Entité identifiée comme la cible de la recherche, s'il y en a une. */
  focus: { kind: KindResultat; id: string; title: string } | null;
  top: (Record<string, unknown> & { kind: KindResultat }) | null;
  sections: Section[];
  counts: Record<string, number>;
  /** Genres du catalogue, pour alimenter le filtre « Genre » de l'interface. */
  genresDisponibles: string[];
  /** Vrai si les résultats viennent d'un rattrapage sur faute de frappe. */
  approximatif: boolean;
};

/* ------------------------------------------------------- paramétrage ---- */

/** Taille maximale du vivier ramené par collection avant notation. */
const VIVIER = { songs: 220, artists: 120, albums: 120, playlists: 120, events: 80, users: 60 };
/** Vivier du second passage (fautes de frappe), trié par popularité. */
const RATTRAPAGE = { songs: 600, artists: 400 };
/** Nombre d'éléments montrés dans une section d'aperçu (`type=all`). */
const APERCU = 8;
/** En dessous, une correspondance approximative n'est pas retenue. */
const SEUIL_RESSEMBLANCE = 0.62;
/** Score minimal pour qu'une entité soit considérée comme la cible de la recherche. */
const SEUIL_FOCUS = 260;

/**
 * Ce que devient le score d'un résultat de l'autre univers.
 *
 * POURQUOI ON N'EXCLUT PAS
 *
 * Partout ailleurs, les deux répertoires sont étanches : recommandations,
 * lecture automatique, playlists, accueil. La recherche est le seul
 * endroit où quelqu'un DEMANDE explicitement quelque chose, par son nom.
 * Répondre « aucun résultat » à qui tape le nom exact d'un artiste parce
 * qu'il est rangé de l'autre côté serait un bug pour l'auditeur, pas une
 * séparation réussie — d'autant qu'un même compte passe d'un univers à
 * l'autre en un clic.
 *
 * Diviser le score par quatre suffit : dans une recherche par mot-clé,
 * l'univers courant occupe tout le haut de chaque section, et l'autre
 * n'apparaît qu'en fin de liste ou lorsqu'il est le seul à répondre — ce
 * qui est précisément le cas d'une recherche par nom.
 */
const FACTEUR_AUTRE_UNIVERS = 0.25;

/** Poids de base par champ — c'est lui qui impose l'ordre demandé au cahier des charges. */
const POIDS = {
  titre: 100,
  artiste: 70,
  album: 50,
  playlist: 35,
  genre: 30,
  tag: 25,
  texte: 10,
};

/* ------------------------------------------------------------ notation -- */

type Champ = { valeur?: string | null; poids: number };

/**
 * Note un champ face à la saisie.
 *
 * L'échelle est volontairement très étalée (×10 pour l'exact, ×1.5 pour un
 * mot isolé) : elle doit dominer la popularité, qui ne sert qu'à départager
 * des correspondances de même nature.
 */
function noterChamp(mots: string[], phrase: string, valeur: string | null | undefined, poids: number): number {
  if (!valeur) return 0;
  const cible = normaliser(valeur);
  if (!cible) return 0;

  if (cible === phrase) return poids * 10;
  if (cible.startsWith(phrase)) return poids * 6;
  if (cible.includes(phrase)) return poids * 4.5;

  const presents = mots.filter((mot) => cible.includes(mot));
  if (presents.length === mots.length && mots.length > 0) return poids * 3;
  if (presents.length > 0) return poids * 1.5 * (presents.length / mots.length);

  // Dernier recours : faute de frappe. Jamais au-dessus d'une vraie
  // correspondance partielle, pour ne pas remonter un homonyme devant le
  // titre que l'utilisateur a effectivement tapé.
  const r = ressemblance(phrase, cible);
  return r >= SEUIL_RESSEMBLANCE ? poids * 2 * r : 0;
}

/** Popularité ramenée à une échelle logarithmique bornée (0 → 60). */
function notePopularite(ecoutes = 0, favoris = 0): number {
  const brut = ecoutes + favoris * 3;
  return Math.min(60, Math.log10(1 + brut) * 22);
}

/** Bonus de fraîcheur : plein pour une sortie du mois, nul au-delà d'un an. */
function noteRecence(date?: Date | string | null): number {
  if (!date) return 0;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return 0;
  const jours = (Date.now() - t) / 86_400_000;
  if (jours < 0) return 0; // sortie planifiée
  if (jours > 365) return 0;
  return 25 * (1 - jours / 365);
}

function noter(
  mots: string[],
  phrase: string,
  champs: Champ[],
  popularite = 0,
  date?: Date | string | null
): { score: number; direct: boolean } {
  const scores = champs.map((c) => noterChamp(mots, phrase, c.valeur, c.poids)).sort((a, b) => b - a);
  if (scores.length === 0 || scores[0] === 0) return { score: 0, direct: false };

  // Le meilleur champ porte le score ; les autres ne comptent qu'au quart.
  // C'est le « nombre de correspondances » du cahier des charges : un titre
  // qui matche ET dont l'artiste matche passe devant.
  let total = scores[0];
  for (const s0 of scores.slice(1)) total += s0 * 0.25;

  total += popularite;
  total += noteRecence(date);

  // « Direct » distingue une vraie correspondance d'une approximation : le
  // seuil du meilleur champ à ×3 correspond à « tous les mots présents ».
  const direct = scores[0] >= Math.max(...champs.map((c) => c.poids)) * 2.9;
  return { score: total, direct };
}

/* ------------------------------------------------------------- helpers -- */

const s = (v: unknown) => (v === undefined || v === null ? "" : String(v));

/**
 * Un `$or` textuel : un document est candidat dès qu'UN mot apparaît dans
 * UN champ.
 *
 * Les mots de deux lettres sont ancrés sur un début de mot. Sans cela,
 * chercher « Na Lingi » faisait remonter dix-huit artistes — tous ceux dont
 * le nom contient « na » quelque part, « Fanja » comprise. Ancrer ne coûte
 * rien et supprime l'essentiel de ce bruit.
 */
function conditionsTexte(mots: string[], champs: string[]): Record<string, unknown>[] {
  const conditions: Record<string, unknown>[] = [];
  for (const mot of mots) {
    const rx = mot.length <= 2 ? regexMotAncre(mot) : regexMot(mot);
    for (const champ of champs) conditions.push({ [champ]: rx });
  }
  return conditions;
}

/** Assemble un filtre à partir d'un `$or` — jamais `{}`, qui ramènerait tout. */
function filtreOu(base: Record<string, unknown>, conditions: Record<string, unknown>[]) {
  if (conditions.length === 0) return { ...base, _id: { $in: [] as unknown[] } };
  return { ...base, $or: conditions };
}

function trier<T extends { score: number }>(
  items: T[],
  tri: TriRecherche,
  dateDe: (i: T) => unknown,
  popDe: (i: T) => number
) {
  if (tri === "popularity") return [...items].sort((a, b) => popDe(b) - popDe(a) || b.score - a.score);
  if (tri === "date") {
    return [...items].sort((a, b) => {
      const da = new Date(s(dateDe(a))).getTime() || 0;
      const db = new Date(s(dateDe(b))).getTime() || 0;
      return db - da || b.score - a.score;
    });
  }
  return [...items].sort((a, b) => b.score - a.score);
}

function estTronque(type: string, taille: number): boolean {
  const plafond = (VIVIER as Record<string, number>)[type];
  return plafond !== undefined && taille >= plafond;
}

/* ------------------------------------------- projections des documents -- */

const CHAMPS_SONG =
  "title coverUrl audioUrl duration genre tags releaseDate playsCount likesCount explicit artist album featuring composer producer univers";
const CHAMPS_ARTIST = "stageName verified coverUrl bannerUrl genres totalPlays followers bio user univers";
const CHAMPS_ALBUM = "title coverUrl type releaseDate songs artist description univers";
const CHAMPS_PLAYLIST = "title coverUrl description tags owner songs followers createdAt univers";
const CHAMPS_EVENT = "title coverUrl location date price ticketUrl artist description";

/* ------------------------------------------------------------ moteur ---- */

export async function rechercheGlobale(opts: OptionsRecherche): Promise<ResultatRecherche> {
  const phrase = normaliser(opts.q);
  const mots = motsDe(opts.q);

  const vide: ResultatRecherche = {
    q: opts.q,
    type: opts.type,
    page: opts.page,
    limit: opts.limit,
    focus: null,
    top: null,
    sections: [],
    counts: {},
    genresDisponibles: [],
    approximatif: false,
  };
  if (mots.length === 0) return vide;

  /* --- 1. Artistes d'abord : leurs identifiants servent à tout le reste - */

  const artistsBrut = await Artist.find(filtreOu({}, conditionsTexte(mots, ["stageName", "genres", "bio"])))
    .select(CHAMPS_ARTIST)
    .sort({ totalPlays: -1 })
    .limit(VIVIER.artists)
    .lean();

  // Seuls les artistes dont le NOM correspond vraiment servent de pivot :
  // un artiste retenu pour un mot de sa biographie ne doit pas faire
  // remonter tout son catalogue.
  const idsPivots = artistsBrut
    .filter((a) => noterChamp(mots, phrase, s(a.stageName), POIDS.titre) >= POIDS.titre * 2.9)
    .map((a) => a._id);

  /* --- 2. Viviers ------------------------------------------------------ */

  const baseSong: Record<string, unknown> = { status: "published" };
  if (opts.genre) baseSong.genre = opts.genre;
  if (opts.artistId) baseSong.artist = opts.artistId;
  if (opts.albumId) baseSong.album = opts.albumId;

  const orSongs = [
    ...conditionsTexte(mots, ["title", "genre", "tags", "composer", "producer", "description"]),
    ...(idsPivots.length ? [{ artist: { $in: idsPivots } }, { "featuring.artist": { $in: idsPivots } }] : []),
  ];
  const orAlbums = [
    ...conditionsTexte(mots, ["title", "description"]),
    ...(idsPivots.length ? [{ artist: { $in: idsPivots } }] : []),
  ];
  const orEvents = [
    ...conditionsTexte(mots, ["title", "description", "location"]),
    ...(idsPivots.length ? [{ artist: { $in: idsPivots } }] : []),
  ];

  const [songsBrut, albumsBrut, playlistsBrut, eventsBrut, genresBrut, proprietairesPublics] = await Promise.all([
    Song.find(filtreOu(baseSong, orSongs))
      .populate("artist", "stageName verified coverUrl")
      .populate("album", "title coverUrl type")
      .select(CHAMPS_SONG)
      .sort({ playsCount: -1 })
      .limit(VIVIER.songs)
      .lean(),

    Album.find(filtreOu(opts.artistId ? { artist: opts.artistId } : {}, orAlbums))
      .populate("artist", "stageName verified coverUrl")
      .select(CHAMPS_ALBUM)
      .sort({ releaseDate: -1 })
      .limit(VIVIER.albums)
      .lean(),

    Playlist.find(filtreOu({ isPublic: true }, conditionsTexte(mots, ["title", "description", "tags"])))
      .populate("owner", "name avatarUrl")
      .select(CHAMPS_PLAYLIST)
      .sort({ createdAt: -1 })
      .limit(VIVIER.playlists)
      .lean(),

    Event.find(filtreOu({ status: "published" }, orEvents))
      .populate("artist", "stageName verified")
      .select(CHAMPS_EVENT)
      .sort({ date: 1 })
      .limit(VIVIER.events)
      .lean(),

    // Le filtre « Genre » de l'interface ne propose que les genres de
    // l'univers courant : proposer « Gospel » à qui parcourt le catalogue
    // général mènerait à une liste vide.
    Song.aggregate([
      { $match: { status: "published", ...(opts.univers ? { univers: opts.univers } : {}) } },
      { $group: { _id: "$genre", count: { $sum: 1 } } },
    ]),

    // Les comptes ayant publié une playlist publique : ils passent devant
    // les autres profils, s'étant déjà rendus visibles d'eux-mêmes.
    Playlist.distinct("owner", { isPublic: true }),
  ]);

  // Depuis que chaque compte a une adresse publique (/membre/<username>),
  // tout membre non suspendu est trouvable — par son nom ou par ce nom
  // d'utilisateur. Les profils restent la dernière section des résultats :
  // on cherche d'abord de la musique sur Moziik.
  const usersBrut = await User.find(
    filtreOu({ suspended: { $ne: true } }, conditionsTexte(mots, ["name", "username"]))
  )
    .select("name username avatarUrl role")
    .limit(VIVIER.users)
    .lean();

  const ensemblePublics = new Set(proprietairesPublics.map((id) => String(id)));

  /* --- 3. Notation ----------------------------------------------------- */

  type Note<T> = T & { score: number; direct: boolean };

  // Les entités sans univers — comptes, genres, évènements — gardent leur
  // score intact : elles n'appartiennent à aucun des deux répertoires.
  const facteurUnivers = (item: Record<string, unknown>) => {
    if (!opts.univers) return 1;
    const univers = item.univers;
    if (typeof univers !== "string") return 1;
    return univers === opts.univers ? 1 : FACTEUR_AUTRE_UNIVERS;
  };

  const noteDe = <T extends Record<string, unknown>>(item: T, r: { score: number; direct: boolean }): Note<T> => ({
    ...item,
    score: r.score * facteurUnivers(item),
    direct: r.direct,
  });

  const noterSong = (song: Record<string, unknown>) => {
    const artiste = song.artist as { stageName?: string } | null;
    const album = song.album as { title?: string } | null;
    return noteDe(
      song,
      noter(
        mots,
        phrase,
        [
          { valeur: s(song.title), poids: POIDS.titre },
          { valeur: artiste?.stageName, poids: POIDS.artiste },
          { valeur: album?.title, poids: POIDS.album },
          { valeur: s(song.genre), poids: POIDS.genre },
          { valeur: ((song.tags as string[]) ?? []).join(" "), poids: POIDS.tag },
          { valeur: [song.composer, song.producer].filter(Boolean).join(" "), poids: POIDS.texte },
        ],
        notePopularite(Number(song.playsCount ?? 0), Number(song.likesCount ?? 0)),
        song.releaseDate as string | undefined
      )
    );
  };

  const noterArtist = (artiste: Record<string, unknown>) =>
    noteDe(
      artiste,
      noter(
        mots,
        phrase,
        [
          { valeur: s(artiste.stageName), poids: POIDS.titre },
          { valeur: ((artiste.genres as string[]) ?? []).join(" "), poids: POIDS.genre },
          { valeur: s(artiste.bio).slice(0, 400), poids: POIDS.texte },
        ],
        notePopularite(Number(artiste.totalPlays ?? 0), ((artiste.followers as unknown[]) ?? []).length)
      )
    );

  let songs = (songsBrut as unknown as Record<string, unknown>[]).map(noterSong).filter((x) => x.score > 0);
  let artists = (artistsBrut as unknown as Record<string, unknown>[]).map(noterArtist).filter((x) => x.score > 0);

  const albums = (albumsBrut as unknown as Record<string, unknown>[])
    .map((album) => {
      const artiste = album.artist as { stageName?: string } | null;
      return noteDe(
        album,
        noter(
          mots,
          phrase,
          [
            { valeur: s(album.title), poids: POIDS.titre },
            { valeur: artiste?.stageName, poids: POIDS.artiste },
            { valeur: s(album.description).slice(0, 400), poids: POIDS.texte },
          ],
          notePopularite(((album.songs as unknown[]) ?? []).length * 3),
          album.releaseDate as string | undefined
        )
      );
    })
    .filter((x) => x.score > 0);

  const playlists = (playlistsBrut as unknown as Record<string, unknown>[])
    .map((playlist) => {
      const owner = playlist.owner as { name?: string } | null;
      return noteDe(
        playlist,
        noter(
          mots,
          phrase,
          [
            { valeur: s(playlist.title), poids: POIDS.playlist },
            { valeur: ((playlist.tags as string[]) ?? []).join(" "), poids: POIDS.tag },
            { valeur: owner?.name, poids: POIDS.texte },
            { valeur: s(playlist.description).slice(0, 400), poids: POIDS.texte },
          ],
          notePopularite(((playlist.followers as unknown[]) ?? []).length * 5),
          playlist.createdAt as string | undefined
        )
      );
    })
    .filter((x) => x.score > 0);

  const events = (eventsBrut as unknown as Record<string, unknown>[])
    .map((ev) => {
      const artiste = ev.artist as { stageName?: string } | null;
      return noteDe(
        ev,
        noter(mots, phrase, [
          { valeur: s(ev.title), poids: POIDS.titre },
          { valeur: artiste?.stageName, poids: POIDS.artiste },
          { valeur: s(ev.location), poids: POIDS.texte },
          { valeur: s(ev.description).slice(0, 300), poids: POIDS.texte },
        ])
      );
    })
    .filter((x) => x.score > 0);

  const users = (usersBrut as unknown as Record<string, unknown>[])
    .map((u) => {
      const base = noter(mots, phrase, [
        { valeur: s(u.name), poids: POIDS.titre },
        // Le nom d'utilisateur est une adresse exacte : le taper, c'est
        // désigner quelqu'un, pas décrire une recherche.
        { valeur: s(u.username), poids: POIDS.titre },
      ]);
      // Un profil qui a publié quelque chose passe devant un compte qui n'a
      // rien montré, à pertinence textuelle égale.
      const bonus = ensemblePublics.has(String(u._id)) ? 1.15 : 1;
      return noteDe(u, { ...base, score: base.score * bonus });
    })
    .filter((x) => x.score > 0);

  // Le nom d'un genre EST le titre de cette entité : il se note au même
  // poids qu'un titre, sinon une recherche « Afrobeat » place le genre
  // derrière n'importe quel morceau de ce genre.
  const genres = (genresBrut as { _id: string | null; count: number }[])
    .filter((g) => g._id)
    .map((g) => ({
      _id: g._id as string,
      name: g._id as string,
      count: g.count,
      ...noter(mots, phrase, [{ valeur: g._id, poids: POIDS.titre }]),
    }))
    .filter((g) => g.score > 0)
    .sort((a, b) => b.score - a.score);

  /* --- 4. Rattrapage des fautes de frappe ------------------------------ */

  let approximatif = false;
  if (songs.length === 0 && artists.length === 0 && albums.length === 0 && playlists.length === 0) {
    const [artistesPop, titresPop] = await Promise.all([
      Artist.find({}).select(CHAMPS_ARTIST).sort({ totalPlays: -1 }).limit(RATTRAPAGE.artists).lean(),
      Song.find({ status: "published" })
        .populate("artist", "stageName verified coverUrl")
        .populate("album", "title coverUrl type")
        .select(CHAMPS_SONG)
        .sort({ playsCount: -1 })
        .limit(RATTRAPAGE.songs)
        .lean(),
    ]);
    artists = (artistesPop as unknown as Record<string, unknown>[]).map(noterArtist).filter((x) => x.score > 0);
    songs = (titresPop as unknown as Record<string, unknown>[]).map(noterSong).filter((x) => x.score > 0);
    approximatif = songs.length > 0 || artists.length > 0;
  }

  /* --- 5. Tri et cible ------------------------------------------------- */

  const songsTries = trier(songs, opts.sort, (x) => x.releaseDate, (x) => Number(x.playsCount ?? 0));
  const artistsTries = trier(artists, opts.sort, (x) => x.createdAt, (x) => Number(x.totalPlays ?? 0));
  const albumsTries = trier(albums, opts.sort, (x) => x.releaseDate, (x) => ((x.songs as unknown[]) ?? []).length);
  const playlistsTries = trier(
    playlists,
    opts.sort,
    (x) => x.createdAt,
    (x) => ((x.followers as unknown[]) ?? []).length
  );
  const eventsTries = [...events].sort((a, b) => b.score - a.score);
  const usersTries = [...users].sort((a, b) => b.score - a.score);

  const candidatsTop: { kind: KindResultat; item: Note<Record<string, unknown>> }[] = [
    ...(artistsTries[0] ? [{ kind: "artist" as const, item: artistsTries[0] }] : []),
    ...(songsTries[0] ? [{ kind: "song" as const, item: songsTries[0] }] : []),
    ...(albumsTries[0] ? [{ kind: "album" as const, item: albumsTries[0] }] : []),
    ...(playlistsTries[0] ? [{ kind: "playlist" as const, item: playlistsTries[0] }] : []),
    ...(genres[0] ? [{ kind: "genre" as const, item: genres[0] as unknown as Note<Record<string, unknown>> }] : []),
  ].sort((a, b) => b.item.score - a.item.score);

  const meilleur = candidatsTop[0] ?? null;
  const top = meilleur ? { ...meilleur.item, kind: meilleur.kind } : null;
  const focus =
    meilleur && meilleur.item.score >= SEUIL_FOCUS
      ? {
          kind: meilleur.kind,
          id: s(meilleur.item._id),
          title: s(meilleur.item.title ?? meilleur.item.stageName ?? meilleur.item.name),
        }
      : null;

  // Le filtre « Genre » de l'interface a besoin de la liste complète, pas
  // seulement des genres qui correspondent à la saisie. L'agrégation est
  // déjà faite ci-dessus : la réutiliser ne coûte rien.
  const genresDisponibles = (genresBrut as { _id: string | null; count: number }[])
    .filter((g) => g._id)
    .sort((a, b) => b.count - a.count)
    .slice(0, 24)
    .map((g) => g._id as string);

  const counts = {
    songs: songsTries.length,
    artists: artistsTries.length,
    albums: albumsTries.length,
    playlists: playlistsTries.length,
    events: eventsTries.length,
    users: usersTries.length,
    genres: genres.length,
  };

  /* --- 6. Vue paginée d'une seule catégorie ---------------------------- */

  if (opts.type !== "all") {
    const parType: Record<
      Exclude<TypeFiltre, "all">,
      { liste: Record<string, unknown>[]; kind: KindResultat; titre: string; disposition: Section["disposition"] }
    > = {
      songs: { liste: songsTries, kind: "song", titre: "Titres", disposition: "liste" },
      artists: { liste: artistsTries, kind: "artist", titre: "Artistes", disposition: "grille" },
      albums: { liste: albumsTries, kind: "album", titre: "Albums, EP et singles", disposition: "grille" },
      playlists: { liste: playlistsTries, kind: "playlist", titre: "Playlists", disposition: "grille" },
      events: { liste: eventsTries, kind: "event", titre: "Évènements", disposition: "grille" },
      users: { liste: usersTries, kind: "user", titre: "Profils publics", disposition: "grille" },
      genres: {
        liste: genres as unknown as Record<string, unknown>[],
        kind: "genre",
        titre: "Genres",
        disposition: "grille",
      },
    };
    const cible = parType[opts.type];
    const debut = (opts.page - 1) * opts.limit;
    return {
      ...vide,
      focus,
      top,
      approximatif,
      counts,
      genresDisponibles,
      sections: [
        {
          key: opts.type,
          title: cible.titre,
          kind: cible.kind,
          items: cible.liste.slice(debut, debut + opts.limit),
          total: cible.liste.length,
          disposition: cible.disposition,
          tronque: estTronque(opts.type, cible.liste.length),
        },
      ],
    };
  }

  /* --- 7. Vue globale : catégories + relations ------------------------- */

  const sections: Section[] = [];
  const ajouter = (
    key: string,
    title: string,
    kind: KindResultat,
    liste: Record<string, unknown>[],
    disposition: Section["disposition"],
    voirTout?: TypeFiltre,
    tronque?: boolean
  ) => {
    if (liste.length === 0) return;
    sections.push({
      key,
      title,
      kind,
      items: liste.slice(0, APERCU),
      total: liste.length,
      disposition,
      voirTout,
      tronque,
    });
  };

  // Les titres d'un artiste cible remontent déjà dans « Titres » grâce à la
  // jointure par identifiant : on nomme donc la section plutôt que d'en
  // créer une seconde qui répéterait les mêmes lignes.
  const nomArtiste = focus?.kind === "artist" ? focus.title : null;

  ajouter("artists", "Artistes", "artist", artistsTries, "carrousel", "artists", estTronque("artists", artistsTries.length));
  ajouter(
    "songs",
    nomArtiste ? `Tous les titres de ${nomArtiste}` : "Titres",
    "song",
    songsTries,
    "liste",
    "songs",
    estTronque("songs", songsTries.length)
  );

  const albumsSeuls = albumsTries.filter((a) => a.type === "album");
  const epsSeuls = albumsTries.filter((a) => a.type !== "album");
  ajouter("albums", nomArtiste ? `Albums de ${nomArtiste}` : "Albums", "album", albumsSeuls, "carrousel", "albums");
  ajouter("eps", nomArtiste ? `EP et singles de ${nomArtiste}` : "EP et singles", "album", epsSeuls, "carrousel", "albums");

  ajouter(
    "playlists",
    "Playlists",
    "playlist",
    playlistsTries,
    "carrousel",
    "playlists",
    estTronque("playlists", playlistsTries.length)
  );
  ajouter("genres", "Genres et radios", "genre", genres as unknown as Record<string, unknown>[], "grille", "genres");
  ajouter(
    "events",
    nomArtiste ? `Évènements de ${nomArtiste}` : "Évènements",
    "event",
    eventsTries,
    "carrousel",
    "events"
  );
  ajouter("users", "Profils publics", "user", usersTries, "carrousel", "users");

  sections.push(...(await sectionsLiees({ focus, songsTries, artistsTries })));

  return { ...vide, focus, top, sections, counts, genresDisponibles, approximatif };
}

/* ------------------------------------------------- suggestions rapides -- */

export type Suggestion = {
  kind: KindResultat;
  _id: string;
  title: string;
  subtitle: string;
  coverUrl?: string;
  verified?: boolean;
  href: string;
  score: number;
};

/**
 * Suggestions affichées PENDANT la frappe.
 *
 * Volontairement séparé de `rechercheGlobale` : cette route est appelée à
 * chaque pause de saisie, elle ne doit toucher que quatre collections, sans
 * aucune requête de relation. Une suggestion qui arrive après la frappe
 * suivante ne sert à rien.
 */
export async function suggestionsRapides(q: string, limite = 8, univers?: Univers): Promise<Suggestion[]> {
  const phrase = normaliser(q);
  const mots = motsDe(q);
  if (mots.length === 0) return [];

  // Même règle que la recherche complète : on hiérarchise, on n'exclut
  // pas. Taper le nom exact d'un artiste doit le faire apparaître, de
  // quelque côté de la frontière qu'il soit rangé.
  const facteur = (item: { univers?: unknown }) =>
    !univers || typeof item.univers !== "string" || item.univers === univers ? 1 : FACTEUR_AUTRE_UNIVERS;

  const [songs, artists, albums, playlists] = await Promise.all([
    Song.find(filtreOu({ status: "published" }, conditionsTexte(mots, ["title"])))
      .populate("artist", "stageName verified")
      .select("title coverUrl playsCount likesCount artist univers")
      .sort({ playsCount: -1 })
      .limit(30)
      .lean(),
    Artist.find(filtreOu({}, conditionsTexte(mots, ["stageName"])))
      .select("stageName verified coverUrl totalPlays univers")
      .sort({ totalPlays: -1 })
      .limit(20)
      .lean(),
    Album.find(filtreOu({}, conditionsTexte(mots, ["title"])))
      .populate("artist", "stageName")
      .select("title coverUrl type artist univers")
      .limit(20)
      .lean(),
    Playlist.find(filtreOu({ isPublic: true }, conditionsTexte(mots, ["title"])))
      .select("title coverUrl songs univers")
      .limit(20)
      .lean(),
  ]);

  const propositions: Suggestion[] = [
    ...artists.map((a) => ({
      kind: "artist" as const,
      _id: s(a._id),
      title: s(a.stageName),
      subtitle: "Artiste",
      coverUrl: s(a.coverUrl) || undefined,
      verified: !!a.verified,
      href: `/artiste/${s(a._id)}`,
      score:
        noter(mots, phrase, [{ valeur: s(a.stageName), poids: POIDS.titre }], notePopularite(a.totalPlays)).score *
        facteur(a),
    })),
    ...songs.map((so) => {
      const artiste = so.artist as unknown as { stageName?: string; verified?: boolean } | null;
      return {
        kind: "song" as const,
        _id: s(so._id),
        title: s(so.title),
        subtitle: `Titre · ${artiste?.stageName ?? "Artiste supprimé"}`,
        coverUrl: s(so.coverUrl) || undefined,
        verified: !!artiste?.verified,
        href: `/son/${s(so._id)}`,
        score: noter(
          mots,
          phrase,
          [
            { valeur: s(so.title), poids: POIDS.titre },
            { valeur: artiste?.stageName, poids: POIDS.artiste },
          ],
          notePopularite(so.playsCount, so.likesCount)
        ).score * facteur(so),
      };
    }),
    ...albums.map((al) => {
      const artiste = al.artist as unknown as { stageName?: string } | null;
      return {
        kind: "album" as const,
        _id: s(al._id),
        title: s(al.title),
        subtitle: `${al.type === "album" ? "Album" : al.type === "ep" ? "EP" : "Single"}${
          artiste?.stageName ? ` · ${artiste.stageName}` : ""
        }`,
        coverUrl: s(al.coverUrl) || undefined,
        href: `/album/${s(al._id)}`,
        score: noter(mots, phrase, [{ valeur: s(al.title), poids: POIDS.titre }]).score * facteur(al),
      };
    }),
    ...playlists.map((p) => ({
      kind: "playlist" as const,
      _id: s(p._id),
      title: s(p.title),
      subtitle: `Playlist · ${(p.songs ?? []).length} titre${(p.songs ?? []).length > 1 ? "s" : ""}`,
      coverUrl: s(p.coverUrl) || undefined,
      href: `/playlist/${s(p._id)}`,
      score: noter(mots, phrase, [{ valeur: s(p.title), poids: POIDS.playlist }]).score * facteur(p),
    })),
  ];

  return propositions
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limite);
}

/* -------------------------------------------------------- relations ----- */

type ContexteRelations = {
  focus: ResultatRecherche["focus"];
  songsTries: Record<string, unknown>[];
  artistsTries: Record<string, unknown>[];
};

/**
 * Sections déduites des relations entre contenus.
 *
 * C'est le point 6 du cahier des charges : une playlist doit remonter parce
 * qu'elle CONTIENT un titre trouvé, pas parce que son nom ressemble à la
 * saisie. Ces requêtes ne partent donc plus du texte mais des identifiants
 * déjà trouvés.
 */
async function sectionsLiees(ctx: ContexteRelations): Promise<Section[]> {
  const { focus } = ctx;
  const sections: Section[] = [];
  const pousser = (
    key: string,
    title: string,
    kind: KindResultat,
    items: Record<string, unknown>[],
    disposition: Section["disposition"]
  ) => {
    if (items.length > 0) sections.push({ key, title, kind, items, total: items.length, disposition });
  };

  const idsTitres = ctx.songsTries.slice(0, 60).map((t) => t._id);

  /* ---------------------------------------------------------- artiste -- */
  if (focus?.kind === "artist") {
    const artisteId = focus.id;
    const artiste = ctx.artistsTries.find((a) => String(a._id) === artisteId) as
      | { genres?: string[]; user?: unknown }
      | undefined;

    const [playlistsDeLArtiste, playlistsAvecSaMusique, collaborations, similaires] = await Promise.all([
      // Playlists créées par l'artiste : Playlist.owner pointe vers un User,
      // pas un Artist — d'où le passage par artiste.user.
      artiste?.user
        ? Playlist.find({ owner: artiste.user, isPublic: true })
            .populate("owner", "name avatarUrl")
            .select(CHAMPS_PLAYLIST)
            .limit(20)
            .lean()
        : Promise.resolve([]),

      idsTitres.length
        ? Playlist.find({ isPublic: true, songs: { $in: idsTitres } })
            .populate("owner", "name avatarUrl")
            .select(CHAMPS_PLAYLIST)
            .limit(20)
            .lean()
        : Promise.resolve([]),

      Song.find({
        status: "published",
        $or: [{ "featuring.artist": artisteId }, { artist: artisteId, "featuring.0": { $exists: true } }],
      })
        .populate("artist", "stageName verified coverUrl")
        .populate("featuring.artist", "stageName verified")
        .select(CHAMPS_SONG)
        .limit(30)
        .lean(),

      artiste?.genres?.length
        ? Artist.find({ _id: { $ne: artisteId }, genres: { $in: artiste.genres } })
            .select("stageName verified coverUrl genres totalPlays")
            .sort({ totalPlays: -1 })
            .limit(12)
            .lean()
        : Promise.resolve([]),
    ]);

    const idsPlaylistsArtiste = new Set(playlistsDeLArtiste.map((p) => String(p._id)));

    pousser(
      "artistPlaylists",
      `Playlists de ${focus.title}`,
      "playlist",
      playlistsDeLArtiste as unknown as Record<string, unknown>[],
      "carrousel"
    );
    pousser(
      "playlistsWithArtist",
      "Playlists contenant sa musique",
      "playlist",
      // On ne répète pas celles qu'il a lui-même créées : elles ont déjà
      // leur section juste au-dessus.
      playlistsAvecSaMusique.filter((p) => !idsPlaylistsArtiste.has(String(p._id))) as unknown as Record<
        string,
        unknown
      >[],
      "carrousel"
    );
    pousser("collaborations", "Collaborations", "song", collaborations as unknown as Record<string, unknown>[], "liste");
    pousser("similarArtists", "Artistes similaires", "artist", similaires as unknown as Record<string, unknown>[], "carrousel");
    return sections;
  }

  /* ------------------------------------------------------------ titre -- */
  if (focus?.kind === "song") {
    const titre = await Song.findById(focus.id).select("artist album genre title tags").lean();
    if (!titre) return sections;

    const baseTitre = normaliser(s(titre.title)).replace(/\s*[([-].*$/, "").trim();

    const [autresDuMemeArtiste, playlistsPortantLeTitre, proches, versions, albumDuTitre] = await Promise.all([
      Song.find({ status: "published", artist: titre.artist, _id: { $ne: titre._id } })
        .populate("artist", "stageName verified coverUrl")
        .select(CHAMPS_SONG)
        .sort({ playsCount: -1 })
        .limit(20)
        .lean(),

      Playlist.find({ isPublic: true, songs: titre._id })
        .populate("owner", "name avatarUrl")
        .select(CHAMPS_PLAYLIST)
        .limit(16)
        .lean(),

      Song.find({
        status: "published",
        _id: { $ne: titre._id },
        $or: [{ genre: titre.genre }, ...(titre.tags?.length ? [{ tags: { $in: titre.tags } }] : [])],
      })
        .populate("artist", "stageName verified coverUrl")
        .select(CHAMPS_SONG)
        .sort({ playsCount: -1 })
        .limit(16)
        .lean(),

      // Versions et remixes : même base de titre, interprète éventuellement
      // différent. Le motif est construit à partir du titre stocké, pas de
      // la saisie — il ne peut donc pas être détourné.
      baseTitre.length >= 3
        ? Song.find({ status: "published", _id: { $ne: titre._id }, title: { $regex: baseTitre, $options: "i" } })
            .populate("artist", "stageName verified coverUrl")
            .select(CHAMPS_SONG)
            .limit(12)
            .lean()
        : Promise.resolve([]),

      titre.album
        ? Album.findById(titre.album).populate("artist", "stageName verified").select(CHAMPS_ALBUM).lean()
        : Promise.resolve(null),
    ]);

    if (albumDuTitre) pousser("songAlbum", "Album", "album", [albumDuTitre] as unknown as Record<string, unknown>[], "carrousel");
    pousser(
      "songArtistTracks",
      "Autres titres du même artiste",
      "song",
      autresDuMemeArtiste as unknown as Record<string, unknown>[],
      "liste"
    );
    pousser(
      "playlistsWithSong",
      "Playlists contenant ce titre",
      "playlist",
      playlistsPortantLeTitre as unknown as Record<string, unknown>[],
      "carrousel"
    );
    pousser("versions", "Versions et remixes", "song", versions as unknown as Record<string, unknown>[], "liste");
    pousser("similarSongs", "Titres similaires", "song", proches as unknown as Record<string, unknown>[], "liste");
    return sections;
  }

  /* ------------------------------------------------------------ album -- */
  if (focus?.kind === "album") {
    const album = await Album.findById(focus.id).select("artist songs title").lean();
    if (!album) return sections;

    // Le lien album/titre existe des DEUX côtés du modèle : `Album.songs`
    // et `Song.album`. Ils ne sont pas toujours d'accord — plusieurs albums
    // du catalogue ont un tableau `songs` vide alors que leurs titres les
    // référencent bien. Interroger un seul côté renvoyait donc un album
    // sans aucune piste. On interroge les deux.
    const titresAlbum = await Song.find({
      status: "published",
      $or: [{ _id: { $in: album.songs ?? [] } }, { album: album._id }],
    })
      .populate("artist", "stageName verified coverUrl")
      .select(CHAMPS_SONG)
      .lean();

    const idsPistes = titresAlbum.map((t) => t._id);

    const [autresAlbums, playlistsAvecAlbum, artistesLies] = await Promise.all([
      Album.find({ artist: album.artist, _id: { $ne: album._id } })
        .populate("artist", "stageName verified")
        .select(CHAMPS_ALBUM)
        .sort({ releaseDate: -1 })
        .limit(16)
        .lean(),

      idsPistes.length
        ? Playlist.find({ isPublic: true, songs: { $in: idsPistes } })
            .populate("owner", "name avatarUrl")
            .select(CHAMPS_PLAYLIST)
            .limit(16)
            .lean()
        : Promise.resolve([]),

      Artist.find({ _id: album.artist }).select("stageName verified coverUrl genres totalPlays").lean(),
    ]);

    pousser("albumTracks", `Titres de « ${album.title} »`, "song", titresAlbum as unknown as Record<string, unknown>[], "liste");
    pousser(
      "artistOtherAlbums",
      "Autres albums de l'artiste",
      "album",
      autresAlbums as unknown as Record<string, unknown>[],
      "carrousel"
    );
    pousser(
      "playlistsWithAlbum",
      "Playlists contenant ces titres",
      "playlist",
      playlistsAvecAlbum as unknown as Record<string, unknown>[],
      "carrousel"
    );
    pousser("albumArtists", "Artiste", "artist", artistesLies as unknown as Record<string, unknown>[], "carrousel");
    return sections;
  }

  /* --------------------------------------------------------- playlist -- */
  if (focus?.kind === "playlist") {
    const playlist = await Playlist.findById(focus.id).select("songs title owner").lean();
    if (!playlist) return sections;

    const titres = await Song.find({ _id: { $in: playlist.songs ?? [] }, status: "published" })
      .populate("artist", "stageName verified coverUrl")
      .populate("album", "title coverUrl type")
      .select(CHAMPS_SONG)
      .lean();

    // Artistes et albums représentés : déduits des titres déjà chargés,
    // aucune requête supplémentaire.
    const parArtiste = new Map<string, { item: Record<string, unknown>; n: number }>();
    const parAlbum = new Map<string, { item: Record<string, unknown>; n: number }>();
    for (const t of titres) {
      const a = t.artist as unknown as Record<string, unknown> | null;
      if (a?._id) {
        const cle = String(a._id);
        const vu = parArtiste.get(cle);
        if (vu) vu.n += 1;
        else parArtiste.set(cle, { item: a, n: 1 });
      }
      const al = t.album as unknown as Record<string, unknown> | null;
      if (al?._id) {
        const cle = String(al._id);
        const vu = parAlbum.get(cle);
        if (vu) vu.n += 1;
        else parAlbum.set(cle, { item: al, n: 1 });
      }
    }

    pousser("playlistTracks", `Titres de « ${playlist.title} »`, "song", titres as unknown as Record<string, unknown>[], "liste");
    pousser(
      "playlistArtists",
      "Artistes principaux",
      "artist",
      [...parArtiste.values()].sort((a, b) => b.n - a.n).map((v) => ({ ...v.item, trackCount: v.n })),
      "carrousel"
    );
    pousser(
      "playlistAlbums",
      "Albums représentés",
      "album",
      [...parAlbum.values()].sort((a, b) => b.n - a.n).map((v) => ({ ...v.item, trackCount: v.n })),
      "carrousel"
    );
    return sections;
  }

  /* -------------------------------------------- aucune cible identifiée - */
  const playlistsPorteuses = idsTitres.length
    ? await Playlist.find({ isPublic: true, songs: { $in: idsTitres } })
        .populate("owner", "name avatarUrl")
        .select(CHAMPS_PLAYLIST)
        .limit(12)
        .lean()
    : [];
  pousser(
    "playlistsAvecTitres",
    "Playlists contenant ces titres",
    "playlist",
    playlistsPorteuses as unknown as Record<string, unknown>[],
    "carrousel"
  );
  return sections;
}
