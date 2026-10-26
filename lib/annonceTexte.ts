/**
 * Le texte mis en forme des annonces de la plateforme.
 *
 * Une syntaxe courte, que l'administration tape ou insère par la barre
 * d'outils : **gras**, *italique*, [texte du lien](adresse), listes à puces
 * (lignes commençant par « - »), paragraphes séparés par une ligne vide.
 *
 * Rien n'est jamais interprété comme du HTML : le texte est découpé ici en
 * morceaux, que l'affichage rend un à un. Une adresse de lien n'est
 * acceptée que si elle commence par https:// ou par « / » (page du site) :
 * pas de javascript:, pas de data:.
 *
 * Module sans dépendance : il sert à la page d'administration, à
 * l'affichage des notifications et au texte brut des notifications push.
 * L'app Android en a une copie (AnnonceTexte.kt) : les deux doivent
 * découper pareil.
 */

export type Morceau =
  | { type: "texte"; valeur: string }
  | { type: "gras"; morceaux: Morceau[] }
  | { type: "italique"; morceaux: Morceau[] }
  | { type: "lien"; adresse: string; morceaux: Morceau[] };

export type Bloc = { type: "paragraphe"; morceaux: Morceau[] } | { type: "liste"; elements: Morceau[][] };

export function adresseAcceptee(adresse: string): boolean {
  return /^https:\/\/[^\s]+$/i.test(adresse) || /^\/(?!\/)[^\s]*$/.test(adresse);
}

/** Les morceaux d'une ligne : gras et italique peuvent s'imbriquer, un lien porte du texte mis en forme. */
export function morceauxDe(texte: string): Morceau[] {
  const resultat: Morceau[] = [];
  let courant = "";
  const pousser = () => {
    if (courant) resultat.push({ type: "texte", valeur: courant });
    courant = "";
  };
  let i = 0;
  while (i < texte.length) {
    if (texte.startsWith("**", i)) {
      const fin = texte.indexOf("**", i + 2);
      if (fin > i + 2) {
        pousser();
        resultat.push({ type: "gras", morceaux: morceauxDe(texte.slice(i + 2, fin)) });
        i = fin + 2;
        continue;
      }
    } else if (texte[i] === "*") {
      const fin = texte.indexOf("*", i + 1);
      if (fin > i + 1 && texte[fin + 1] !== "*") {
        pousser();
        resultat.push({ type: "italique", morceaux: morceauxDe(texte.slice(i + 1, fin)) });
        i = fin + 1;
        continue;
      }
    } else if (texte[i] === "[") {
      const m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(texte.slice(i));
      if (m && adresseAcceptee(m[2])) {
        pousser();
        resultat.push({ type: "lien", adresse: m[2], morceaux: morceauxDe(m[1]) });
        i += m[0].length;
        continue;
      }
    }
    courant += texte[i];
    i += 1;
  }
  pousser();
  return resultat;
}

export function blocsDe(texte: string): Bloc[] {
  const blocs: Bloc[] = [];
  for (const paragraphe of texte.replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
    const lignes = paragraphe.split("\n").filter((l) => l.trim() !== "");
    if (lignes.length === 0) continue;
    if (lignes.every((l) => /^\s*[-•]\s+/.test(l))) {
      blocs.push({ type: "liste", elements: lignes.map((l) => morceauxDe(l.replace(/^\s*[-•]\s+/, ""))) });
    } else {
      blocs.push({ type: "paragraphe", morceaux: morceauxDe(lignes.join("\n")) });
    }
  }
  return blocs;
}

function brut(morceaux: Morceau[]): string {
  return morceaux.map((m) => (m.type === "texte" ? m.valeur : brut(m.morceaux))).join("");
}

/** Le texte sans mise en forme : notification push, aperçu d'une ligne. */
export function texteBrut(texte: string): string {
  return blocsDe(texte)
    .map((b) => (b.type === "paragraphe" ? brut(b.morceaux) : b.elements.map((e) => `• ${brut(e)}`).join("\n")))
    .join("\n\n");
}
