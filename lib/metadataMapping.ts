import { normaliser } from "@/lib/searchText";

/**
 * Rapprochement entre ce qu'un fichier audio déclare et ce que le
 * formulaire de publication accepte.
 *
 * Les balises d'un MP3 sont du texte libre : « Hip Hop », « hip-hop » et
 * « HipHop » désignent le même genre, mais la liste du site n'en propose
 * qu'une orthographe, et le champ est un `<select>`. Sans rapprochement,
 * une balise pourtant correcte se traduirait par « aucune correspondance »
 * dans neuf cas sur dix.
 *
 * Tout est ici, séparé de l'interface, pour que la page de modification
 * d'un titre puisse s'en servir à son tour.
 */

/** Réduit à sa forme comparable : sans accents, sans ponctuation, en minuscules. */
function cle(valeur: string): string {
  return normaliser(valeur).replace(/[^a-z0-9]/g, "");
}

/**
 * Écritures qui ne se rejoignent pas par simple normalisation.
 * Volontairement court : chaque entrée est un choix éditorial, et un
 * rapprochement douteux vaut moins qu'un champ laissé à l'artiste.
 */
const ALIAS_GENRES: Record<string, string[]> = {
  rb: ["rnb", "randb", "rhythmandblues", "rhythmblues"],
  hiphop: ["rap", "raphiphop"],
  evangelique: ["gospel", "worship", "louange", "chretien", "christian"],
  afrobeat: ["afrobeats", "afro", "afropop"],
  electro: ["electronic", "electronica", "edm"],
  variete: ["varietes", "varietefrancaise"],
};

/**
 * Genre du site correspondant à la balise, ou `null`.
 * Comparaison exacte d'abord, puis alias, puis inclusion — dans cet ordre,
 * pour qu'« Afrobeat » ne soit jamais capté par « Afro » si les deux
 * existent dans la liste.
 */
export function genreCorrespondant(brut: string | undefined, genres: string[]): string | null {
  if (!brut?.trim()) return null;
  const cible = cle(brut);
  if (!cible) return null;

  const exact = genres.find((g) => cle(g) === cible);
  if (exact) return exact;

  const parAlias = genres.find((g) => (ALIAS_GENRES[cle(g)] ?? []).includes(cible));
  if (parAlias) return parAlias;

  // L'inverse aussi : la balise porte le nom canonique, la liste un alias.
  const inverse = genres.find((g) => (ALIAS_GENRES[cible] ?? []).includes(cle(g)));
  if (inverse) return inverse;

  return genres.find((g) => cle(g).length >= 4 && cible.includes(cle(g))) ?? null;
}

const CODES_LANGUE: Record<string, string[]> = {
  malagasy: ["mg", "mlg", "malagasy", "malgache"],
  francais: ["fr", "fra", "fre", "french", "francais"],
  anglais: ["en", "eng", "english", "anglais"],
};

/**
 * Langue du site correspondante.
 *
 * Les balises portent le plus souvent un code ISO à deux ou trois lettres
 * (« fra », « eng »), jamais le libellé affiché par le formulaire.
 * Une balise présente mais non reconnue vaut « Autre » — c'est une
 * information, contrairement à l'absence de balise.
 */
export function langueCorrespondante(brut: string | undefined, langues: string[]): string | null {
  if (!brut?.trim()) return null;
  const cible = cle(brut);
  if (!cible) return null;

  for (const langue of langues) {
    if (cle(langue) === cible) return langue;
    if ((CODES_LANGUE[cle(langue)] ?? []).includes(cible)) return langue;
  }
  return langues.find((l) => cle(l) === "autre") ?? null;
}

/** Album de l'artiste portant ce titre, à la casse et aux accents près. */
export function albumCorrespondant<T extends { _id: string; title: string }>(
  brut: string | undefined,
  albums: T[]
): T | null {
  if (!brut?.trim()) return null;
  const cible = cle(brut);
  return albums.find((a) => cle(a.title) === cible) ?? null;
}

const MENTION_FEATURING = /[\s([-]+(?:feat\.?|ft\.?|featuring|avec|with)\s+([^)\]]+)\)?\]?\s*$/i;
const SEPARATEURS_NOMS = /\s*(?:,|&|\bet\b|\band\b|\bx\b|\/|\+)\s*/i;

/**
 * Sépare le titre de ses invités.
 *
 * Deux sources, complémentaires : la mention « (feat. X) » que presque
 * tous les encodeurs collent dans le titre, et la balise `artists` qui
 * liste les interprètes. Aucune des deux n'est fiable seule — beaucoup de
 * fichiers n'ont que la première.
 *
 * Le titre nettoyé est renvoyé à part : c'est à l'appelant de décider s'il
 * l'applique, puisqu'il ne doit le faire que pour les invités réellement
 * rapprochés à un profil existant. Retirer « (feat. X) » sans pouvoir
 * rattacher X perdrait l'information.
 */
export function separerFeaturing(
  titre: string | undefined,
  artistes: string[] | undefined,
  artistePrincipal: string | undefined
): { titreSansMention: string | null; noms: string[] } {
  const mention = titre?.match(MENTION_FEATURING);
  const depuisTitre = mention
    ? mention[1]
        .split(SEPARATEURS_NOMS)
        .map((n) => n.trim())
        .filter(Boolean)
    : [];

  const principal = artistePrincipal ? cle(artistePrincipal) : "";
  const depuisBalise = (artistes ?? []).map((n) => n.trim()).filter((n) => n && cle(n) !== principal);

  const noms: string[] = [];
  for (const nom of [...depuisTitre, ...depuisBalise]) {
    if (!noms.some((n) => cle(n) === cle(nom))) noms.push(nom);
  }

  return {
    titreSansMention: mention && titre ? titre.slice(0, mention.index).trim().replace(/[-–—([]+$/, "").trim() : null,
    noms,
  };
}

/** Vrai quand les deux noms désignent le même artiste, accents et casse mis à part. */
export function memeNom(a: string, b: string): boolean {
  return cle(a) === cle(b) && cle(a).length > 0;
}

/**
 * Tonalité écrite comme le formulaire l'attend : « A Minor » → « Am »,
 * « C# major » → « C# ». Les balises Windows Media utilisent la forme
 * longue, les DAW la forme courte.
 */
export function tonaliteCourte(brut: string | undefined): string | null {
  const t = brut?.trim();
  if (!t) return null;
  const m = t.match(/^([A-Ga-g])\s*([#b♯♭]?)\s*(.*)$/);
  if (!m) return t.slice(0, 12);
  const note = m[1].toUpperCase() + m[2].replace("♯", "#").replace("♭", "b");
  return /min/i.test(m[3]) || /^m$/i.test(m[3].trim()) ? `${note}m` : note;
}

/** Format ISRC canonique : douze caractères alphanumériques, sans séparateurs. */
export function isrcNormalise(brut: string | undefined): string | null {
  const compact = brut?.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return compact && /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(compact) ? compact : (brut?.trim() || null);
}
