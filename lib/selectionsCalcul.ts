import { hasardDe, melangerSansVoisins } from "@/lib/melange";

/**
 * Le calcul des sélections personnelles (Mix du jour, Découvertes de la
 * semaine, Radar des sorties), sans base de données : lib/selections.ts lui
 * apporte les écoutes et les titres, et garde le résultat.
 *
 * Tout tirage au hasard dépend d'une graine (le compte et la période) : la
 * même entrée donne la même sélection, ce qui la rend vérifiable et stable.
 */

export type TitreLeger = {
  _id: string;
  artiste: string;
  genre?: string;
  playsCount: number;
  releaseDate?: Date;
};

/** Ce que l'auditeur écoute : un poids par titre (écoutes, plus un bonus pour un « j'aime »). */
export type Ecoute = { titre: TitreLeger; poids: number };

const GENRES_VAGUES = new Set(["", "autre"]);
const estGenreNet = (g?: string) => !!g && !GENRES_VAGUES.has(g.trim().toLowerCase());

/** Les genres et les artistes de l'auditeur, du plus écouté au moins écouté. */
export function goutsDe(ecoutes: Ecoute[]) {
  const genres = new Map<string, number>();
  const artistes = new Map<string, number>();
  for (const { titre, poids } of ecoutes) {
    if (estGenreNet(titre.genre)) genres.set(titre.genre!, (genres.get(titre.genre!) ?? 0) + poids);
    artistes.set(titre.artiste, (artistes.get(titre.artiste) ?? 0) + poids);
  }
  const trier = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
  return { genres: trier(genres), artistes: trier(artistes) };
}

/** Au-dessous, un genre n'a pas assez été écouté pour faire un mix qui ressemble à l'auditeur. */
const POIDS_MINIMUM_GENRE = 4;

/** Les genres des mix : les plus écoutés, six au plus. */
export function genresDesMix(gouts: ReturnType<typeof goutsDe>, maximum = 6): string[] {
  return gouts.genres.filter(([, poids]) => poids >= POIDS_MINIMUM_GENRE).slice(0, maximum).map(([g]) => g);
}

/** Une graine numérique tirée d'un texte (FNV-1a) : « compte|période|mix ». */
export function graineDe(texte: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Garde au plus `maximum` titres par artiste, dans l'ordre reçu. */
function plafonnerParArtiste(titres: TitreLeger[], maximum: number): TitreLeger[] {
  const compte = new Map<string, number>();
  return titres.filter((t) => {
    const n = compte.get(t.artiste) ?? 0;
    compte.set(t.artiste, n + 1);
    return n < maximum;
  });
}

/**
 * Un Mix du jour : des titres que l'auditeur aime déjà dans ce genre, et
 * des titres du même genre qu'il n'a pas encore entendus, en privilégiant
 * ses artistes puis les titres qui marchent. Mélangé sans deux voisins du
 * même artiste.
 */
export function composerMix({
  familiers,
  candidats,
  artistesAimes,
  graine,
  taille = 40,
}: {
  /** Les titres du genre déjà écoutés ou aimés, du plus au moins écouté. */
  familiers: TitreLeger[];
  /** Les titres publiés du genre. */
  candidats: TitreLeger[];
  /** Le poids de chaque artiste chez l'auditeur. */
  artistesAimes: Map<string, number>;
  graine: number;
  taille?: number;
}): TitreLeger[] {
  const hasard = hasardDe(graine);
  const dejaLa = new Set(familiers.map((t) => t._id));
  const garde = familiers.slice(0, Math.ceil(taille * 0.4));
  const maxEcoutes = Math.max(1, ...candidats.map((t) => t.playsCount));
  const nouveaux = candidats
    .filter((t) => !dejaLa.has(t._id))
    .map((t) => ({
      t,
      note:
        (artistesAimes.has(t.artiste) ? 3 : 0) +
        2 * Math.log1p(t.playsCount) / Math.log1p(maxEcoutes) +
        hasard() * 1.5,
    }))
    .sort((a, b) => b.note - a.note)
    .map((x) => x.t);
  const choisis = plafonnerParArtiste([...garde, ...nouveaux], 4).slice(0, taille);
  return melangerSansVoisins(choisis, (t) => t.artiste, hasard);
}

/**
 * Les Découvertes de la semaine : des titres jamais écoutés, choisis dans
 * les genres et chez les artistes de l'auditeur, avec une part de titres
 * récents. Deux titres par artiste au plus : c'est une découverte, pas une
 * discographie.
 */
export function composerDecouvertes({
  candidats,
  gouts,
  dejaEcoutes,
  graine,
  maintenant,
  taille = 30,
}: {
  candidats: TitreLeger[];
  gouts: ReturnType<typeof goutsDe>;
  dejaEcoutes: Set<string>;
  graine: number;
  maintenant: Date;
  taille?: number;
}): TitreLeger[] {
  const hasard = hasardDe(graine);
  const poidsGenre = new Map(gouts.genres);
  const maxGenre = Math.max(1, ...gouts.genres.map(([, p]) => p));
  const poidsArtiste = new Map(gouts.artistes);
  const maxArtiste = Math.max(1, ...gouts.artistes.map(([, p]) => p));
  const maxEcoutes = Math.max(1, ...candidats.map((t) => t.playsCount));
  const deuxMois = 60 * 86_400_000;

  const notes = candidats
    .filter((t) => !dejaEcoutes.has(t._id))
    .map((t) => {
      const recent = t.releaseDate && maintenant.getTime() - t.releaseDate.getTime() < deuxMois ? 1 : 0;
      const note =
        3 * ((t.genre && poidsGenre.get(t.genre)) || 0) / maxGenre +
        2 * (poidsArtiste.get(t.artiste) ?? 0) / maxArtiste +
        Math.log1p(t.playsCount) / Math.log1p(maxEcoutes) +
        recent +
        hasard() * 2;
      return { t, note };
    })
    .sort((a, b) => b.note - a.note)
    .map((x) => x.t);
  return melangerSansVoisins(plafonnerParArtiste(notes, 2).slice(0, taille), (t) => t.artiste, hasard);
}

/**
 * Le Radar des sorties : les titres sortis récemment chez les artistes que
 * l'auditeur suit ou écoute le plus, du plus récent au plus ancien.
 */
export function composerRadar({
  recents,
  artistesSuivis,
  taille = 30,
}: {
  /** Les titres sortis dans la fenêtre du radar. */
  recents: TitreLeger[];
  artistesSuivis: Set<string>;
  taille?: number;
}): TitreLeger[] {
  return recents
    .filter((t) => artistesSuivis.has(t.artiste))
    .sort((a, b) => (b.releaseDate?.getTime() ?? 0) - (a.releaseDate?.getTime() ?? 0))
    .slice(0, taille);
}

/** « 2026-10-29 » : un Mix du jour change à minuit (heure de Madagascar). */
export function periodeDuJour(maintenant: Date): string {
  const local = new Date(maintenant.getTime() + 3 * 3_600_000);
  return local.toISOString().slice(0, 10);
}

/**
 * « 2026-S44 » : la semaine ISO, du lundi au dimanche (heure de
 * Madagascar). Les Découvertes de la semaine changent le lundi.
 */
export function periodeDeLaSemaine(maintenant: Date): string {
  const local = new Date(maintenant.getTime() + 3 * 3_600_000);
  const jour = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
  const rangJour = jour.getUTCDay() || 7;
  jour.setUTCDate(jour.getUTCDate() + 4 - rangJour);
  const debutAnnee = new Date(Date.UTC(jour.getUTCFullYear(), 0, 1));
  const semaine = Math.ceil(((jour.getTime() - debutAnnee.getTime()) / 86_400_000 + 1) / 7);
  return `${jour.getUTCFullYear()}-S${String(semaine).padStart(2, "0")}`;
}

/** « Rim-Ka, Ckycky et Ceis » puis « et bien plus » : la ligne sous un mix, comme sur Spotify. */
export function descriptionMix(noms: string[]): string {
  const uniques = [...new Set(noms.filter(Boolean))].slice(0, 3);
  if (uniques.length === 0) return "";
  const liste = uniques.length === 1 ? uniques[0] : `${uniques.slice(0, -1).join(", ")}, ${uniques[uniques.length - 1]}`;
  return `${liste} et bien plus`;
}
