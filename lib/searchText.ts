/**
 * Outils de texte pour la recherche.
 *
 * Le problème central : MongoDB **n'applique pas la collation aux
 * requêtes `$regex`**. Une collation `{ locale: "fr", strength: 1 }`
 * rend bien les `$eq` et les tris insensibles à la casse et aux accents,
 * mais un `$regex` reste sensible aux deux. Chercher « hialao » ne
 * trouvait donc pas « Hïalao », et « nandri » ne trouvait rien du tout.
 *
 * Deux réponses, combinées :
 *
 * 1. On normalise la saisie (minuscules, accents retirés) puis on
 *    RE-DÉPLIE chaque lettre en une classe qui couvre ses variantes
 *    accentuées : `e` devient `[eéèêë]`. Le motif obtenu retrouve le
 *    texte accenté stocké en base, dans les deux sens (« café » trouve
 *    « cafe », « cafe » trouve « café »).
 *
 * 2. Pour les fautes de frappe, un `$regex` ne peut rien : on repasse
 *    derrière avec une distance d'édition sur un vivier borné de
 *    candidats (voir `ressemblance`). C'est du travail en mémoire, sur
 *    quelques centaines de chaînes courtes — négligeable, et ça évite
 *    d'imposer un index texte à la base de production.
 *
 * Un index texte MongoDB aurait été l'autre option, mais il ne sait pas
 * faire de correspondance partielle : « Nandri » ne remonterait jamais
 * « Nandrianina », ce qui est précisément l'usage le plus courant.
 */

/** Retire les diacritiques, passe en minuscules, réduit les espaces. */
export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Variantes accentuées à couvrir pour chaque lettre ASCII. */
const VARIANTES: Record<string, string> = {
  a: "aàáâãäåāă",
  c: "cçćč",
  e: "eèéêëēĕėę",
  i: "iìíîïĩī",
  n: "nñń",
  o: "oòóôõöø",
  s: "sśš",
  u: "uùúûüũū",
  y: "yýÿ",
  z: "zźž",
};

const METACARACTERES = /[.*+?^${}()|[\]\\]/g;

/**
 * Motif regex insensible aux accents pour un mot déjà normalisé.
 * Les métacaractères sont échappés : sans ça, une saisie comme « a( »
 * casse la requête, et un motif pathologique peut la faire ramer (ReDoS).
 */
export function motifTolerant(mot: string): string {
  return [...mot]
    .map((lettre) => {
      const variantes = VARIANTES[lettre];
      if (variantes) return `[${variantes}]`;
      return lettre.replace(METACARACTERES, "\\$&");
    })
    .join("");
}

/** Découpe la saisie en mots utiles (les mots d'une lettre sont ignorés). */
export function motsDe(requete: string): string[] {
  return normaliser(requete)
    .split(/[\s,;/_-]+/)
    .filter((mot) => mot.length >= 2)
    .slice(0, 8); // au-delà, la requête n'apporte plus rien et coûte cher
}

/** `{ $regex, $options }` prêt à l'emploi pour un mot. */
export function regexMot(mot: string) {
  return { $regex: motifTolerant(mot), $options: "i" };
}

/**
 * Comme `regexMot`, mais ancré sur un début de mot.
 *
 * Réservé aux saisies très courtes : « na » ne doit pas remonter tout ce
 * qui contient ces deux lettres au milieu d'un nom.
 */
export function regexMotAncre(mot: string) {
  return { $regex: `\\b${motifTolerant(mot)}`, $options: "i" };
}

/**
 * Distance d'édition de Levenshtein, bornée.
 *
 * `plafond` permet d'abandonner tôt : au-delà, la réponse ne nous
 * intéresse plus, et on économise le remplissage de la matrice.
 */
export function distance(a: string, b: string, plafond = 4): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > plafond) return plafond + 1;

  let precedente = Array.from({ length: b.length + 1 }, (_, i) => i);
  let courante = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    courante[0] = i;
    let minLigne = i;
    for (let j = 1; j <= b.length; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      courante[j] = Math.min(courante[j - 1] + 1, precedente[j] + 1, precedente[j - 1] + cout);
      if (courante[j] < minLigne) minLigne = courante[j];
    }
    // Toute la ligne dépasse déjà le plafond : la distance finale aussi.
    if (minLigne > plafond) return plafond + 1;
    [precedente, courante] = [courante, precedente];
  }
  return precedente[b.length];
}

/**
 * Ressemblance entre une saisie et un texte candidat, entre 0 et 1.
 *
 * Ce n'est pas une similarité symétrique : on cherche « la saisie est-elle
 * une approximation d'un morceau du candidat ». « nandri » face à
 * « nandrianina razafindrakoto » doit obtenir un bon score, alors que la
 * distance d'édition brute entre les deux chaînes complètes serait
 * catastrophique. On compare donc la saisie à chaque mot du candidat, et
 * à son préfixe de même longueur.
 */
export function ressemblance(saisieNormalisee: string, candidat: string): number {
  const cible = normaliser(candidat);
  if (!saisieNormalisee || !cible) return 0;
  if (cible === saisieNormalisee) return 1;
  if (cible.includes(saisieNormalisee)) return 0.9;

  const plafond = saisieNormalisee.length <= 4 ? 1 : saisieNormalisee.length <= 7 ? 2 : 3;

  let meilleure = 0;
  const morceaux = [cible, ...cible.split(" ")];
  for (const morceau of morceaux) {
    // Préfixe de même longueur : « nandri » contre les 6 premières
    // lettres de « nandrianina », et non contre le mot entier.
    const prefixe = morceau.slice(0, saisieNormalisee.length);
    const d = Math.min(
      distance(saisieNormalisee, morceau, plafond),
      distance(saisieNormalisee, prefixe, plafond)
    );
    if (d > plafond) continue;
    const score = 1 - d / Math.max(1, saisieNormalisee.length);
    if (score > meilleure) meilleure = score;
  }
  return meilleure;
}
