/*
 * Copie de lib/metadataMapping.ts du site (rapprochement entre ce qu'un
 * fichier déclare et ce que le formulaire de publication accepte), avec la
 * normalisation de lib/searchText.ts. Une correction d'un côté se reporte
 * de l'autre.
 */

/** Les langues du formulaire de publication (app/son/nouveau/page.tsx, LANGUAGES). */
export const LANGUES = ["Malagasy", "Français", "Anglais", "Autre"];
export const LANGUE_PAR_DEFAUT = "Malagasy";

function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Réduit à sa forme comparable : sans accents, sans ponctuation, en minuscules. */
function cle(valeur: string): string {
  return normaliser(valeur).replace(/[^a-z0-9]/g, "");
}

const ALIAS_GENRES: Record<string, string[]> = {
  rb: ["rnb", "randb", "rhythmandblues", "rhythmblues"],
  hiphop: ["rap", "raphiphop"],
  evangelique: ["gospel", "worship", "louange", "chretien", "christian"],
  afrobeat: ["afrobeats", "afro", "afropop"],
  electro: ["electronic", "electronica", "edm"],
  variete: ["varietes", "varietefrancaise"],
};

/** Genre du site correspondant à la balise, ou null : exact, puis alias, puis inclusion. */
export function genreCorrespondant(brut: string | null | undefined, genres: string[]): string | null {
  if (!brut?.trim()) return null;
  const cible = cle(brut);
  if (!cible) return null;
  const exact = genres.find((g) => cle(g) === cible);
  if (exact) return exact;
  const parAlias = genres.find((g) => (ALIAS_GENRES[cle(g)] ?? []).includes(cible));
  if (parAlias) return parAlias;
  const inverse = genres.find((g) => (ALIAS_GENRES[cible] ?? []).includes(cle(g)));
  if (inverse) return inverse;
  return genres.find((g) => cle(g).length >= 4 && cible.includes(cle(g))) ?? null;
}

const CODES_LANGUE: Record<string, string[]> = {
  malagasy: ["mg", "mlg", "malagasy", "malgache"],
  francais: ["fr", "fra", "fre", "french", "francais"],
  anglais: ["en", "eng", "english", "anglais"],
};

/** Langue du site : les balises portent un code ISO ; une balise inconnue vaut « Autre ». */
export function langueCorrespondante(brut: string | null | undefined, langues: string[] = LANGUES): string | null {
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
export function albumCorrespondant<T extends { _id: string; title: string }>(brut: string | undefined, albums: T[]): T | null {
  if (!brut?.trim()) return null;
  const cible = cle(brut);
  return albums.find((a) => cle(a.title) === cible) ?? null;
}

const MENTION_FEATURING = /[\s([-]+(?:feat\.?|ft\.?|featuring|avec|with)\s+([^)\]]+)\)?\]?\s*$/i;
const SEPARATEURS_NOMS = /\s*(?:,|&|\bet\b|\band\b|\bx\b|\/|\+)\s*/i;

/**
 * Sépare le titre de ses invités (« (feat. X) » et balise des interprètes).
 * Le titre nettoyé n'est à appliquer que si les invités ont été rapprochés
 * d'un profil : retirer la mention sans les rattacher perdrait l'information.
 */
export function separerFeaturing(titre: string | undefined, artistes: string[] | undefined, artistePrincipal: string | undefined): { titreSansMention: string | null; noms: string[] } {
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

/** « A Minor » → « Am », « C# major » → « C# ». */
export function tonaliteCourte(brut: string | null | undefined): string | null {
  const t = brut?.trim();
  if (!t) return null;
  const m = t.match(/^([A-Ga-g])\s*([#b♯♭]?)\s*(.*)$/);
  if (!m) return t.slice(0, 12);
  const note = m[1].toUpperCase() + m[2].replace("♯", "#").replace("♭", "b");
  return /min/i.test(m[3]) || /^m$/i.test(m[3].trim()) ? `${note}m` : note;
}

/** ISRC canonique : douze caractères alphanumériques, sans séparateurs. */
export function isrcNormalise(brut: string | null | undefined): string | null {
  const compact = brut?.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return compact && /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(compact) ? compact : brut?.trim() || null;
}

/** Les tags comme TagInput du site : en minuscules, espaces resserrés, sans doublon, quinze au plus. */
export function tagsPropres(valeurs: string[]): string[] {
  const vus = new Set<string>();
  const sortie: string[] = [];
  for (const v of valeurs) {
    const t = v.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 40);
    if (!t || vus.has(t)) continue;
    vus.add(t);
    sortie.push(t);
    if (sortie.length >= 15) break;
  }
  return sortie;
}
