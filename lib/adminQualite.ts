/**
 * Les filtres de la qualité du catalogue, partagés entre les pages qui les
 * traitent (app/api/admin/…) et le compteur « à traiter » de l'administration.
 */

const DEUX_JOURS_MS = 2 * 86_400_000;
/** Au-delà, une sortie « nostalgique » est forcément une date d'import. */
const NOSTALGIE_AVANT = new Date(Date.UTC(2010, 0, 1));

/**
 * Un titre publié à l'année non confirmée, dont la sortie tombe à deux
 * jours de son ajout (la date d'import a servi de date de sortie), ou
 * classé Nostalgie avec une sortie récente.
 */
export const ANNEES_DOUTEUSES = {
  status: "published",
  anneeVerifiee: { $exists: false },
  $or: [
    { $expr: { $lte: [{ $abs: { $subtract: ["$releaseDate", "$createdAt"] } }, DEUX_JOURS_MS] } },
    { genre: "Nostalgie", releaseDate: { $gte: NOSTALGIE_AVANT } },
  ],
};

/** Un titre publié dont le genre proposé par l'analyse attend l'administration. */
export const GENRES_PROPOSES = { status: "published", genrePropose: { $exists: true } };
