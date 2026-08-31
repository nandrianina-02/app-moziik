/**
 * Les deux univers musicaux de Moziik.
 *
 * Un auditeur venu pour la louange ne veut pas d'un titre de club entre
 * deux cantiques, et l'inverse est tout aussi vrai. Plutôt qu'un filtre
 * de plus posé sur un catalogue unique, le site tient deux univers
 * étanches : chacun a ses artistes, ses recommandations, sa lecture
 * automatique, son historique et ses playlists.
 *
 * CE FICHIER N'IMPORTE RIEN, ET C'EST VOULU
 *
 * Le sélecteur d'univers vit dans le navigateur, les filtres vivent dans
 * MongoDB, et l'écran d'administration a besoin des deux libellés. Un
 * import de mongoose ici embarquerait la base dans le paquet client —
 * lib/curation/labels.ts et lib/ai/labels.ts évitent déjà cela chacun de
 * leur côté.
 */

export type Univers = "general" | "christian";

export const UNIVERS: Univers[] = ["general", "christian"];

export const UNIVERS_INFO: Record<Univers, { label: string; court: string; detail: string }> = {
  general: {
    label: "Général",
    court: "Général",
    detail: "Tout le catalogue hors répertoire évangélique.",
  },
  christian: {
    label: "Évangélique",
    court: "Gospel",
    detail: "Gospel, louange, adoration : artistes et titres du répertoire chrétien.",
  },
};

/** Univers d'un visiteur qui n'a jamais choisi, si l'administration n'en fixe pas d'autre. */
export const UNIVERS_PAR_DEFAUT: Univers = "general";

/**
 * Nom du cookie qui porte l'univers actif.
 *
 * Le choix voyage par cookie plutôt que par paramètre d'URL parce que
 * chaque appel du lecteur, de la recherche et de l'accueil devrait sinon
 * le transporter à la main — une trentaine d'endroits, dont plusieurs
 * dans le prolongement de file où l'oubli ne se verrait qu'à la
 * vingtième piste.
 */
export const COOKIE_UNIVERS = "moziik-univers";

/** Un an : le choix d'univers n'est pas une préférence de session. */
export const COOKIE_UNIVERS_MAX_AGE = 365 * 24 * 60 * 60;

export function estUnivers(valeur: unknown): valeur is Univers {
  return valeur === "general" || valeur === "christian";
}

export function normaliserUnivers(valeur: unknown, defaut: Univers = UNIVERS_PAR_DEFAUT): Univers {
  return estUnivers(valeur) ? valeur : defaut;
}

/** L'autre univers. Sert aux messages « ce titre est ailleurs ». */
export function universOppose(univers: Univers): Univers {
  return univers === "general" ? "christian" : "general";
}

export function libelleUnivers(univers: Univers): string {
  return UNIVERS_INFO[univers].label;
}
