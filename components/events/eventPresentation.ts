/**
 * Comment s'écrivent les dates, les prix et les liens de carte d'un
 * évènement.
 *
 * Volontairement sans mongoose ni React — ces fonctions servent aussi bien
 * aux métadonnées générées côté serveur qu'aux composants clients. Les
 * libellés de catégorie, eux, vivent dans `lib/evenements.ts`.
 */

/** « 24 mai 2024 », dans le fuseau du site. */
export function jourLong(date: string | Date, timezone?: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: timezone || undefined,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

/** « 18:00 ». */
export function heure(date: string | Date, timezone?: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: timezone || undefined,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/**
 * « 18:00 – 02:00 » quand la fin est connue, « 18:00 » sinon.
 *
 * Aucune durée n'est supposée : sans `fin`, la page n'affiche qu'une heure
 * de début plutôt qu'une plage inventée.
 */
export function plageHoraire(debut: string | Date, fin?: string | Date | null, timezone?: string): string {
  const d = heure(debut, timezone);
  if (!fin) return d;
  return `${d} – ${heure(fin, timezone)}`;
}

/** « Jusqu'au 10 mai 2024 », pour la date limite d'une catégorie de billets. */
export function jusquAu(date: string | Date, timezone?: string): string {
  return `Jusqu'au ${jourLong(date, timezone)}`;
}

/**
 * Prix affiché dans la devise du site.
 *
 * `0` devient « Gratuit » : c'est une information, pas une absence de prix
 * — un billet à zéro et un évènement sans billetterie ne se disent pas
 * de la même façon.
 */
export function formatPrix(montant: number, devise = "EUR"): string {
  if (montant === 0) return "Gratuit";
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: devise,
      maximumFractionDigits: montant % 1 === 0 ? 0 : 2,
    }).format(montant);
  } catch {
    // Devise inconnue d'Intl : le montant reste lisible, suivi du code.
    return `${montant} ${devise}`;
  }
}

/**
 * Lien de carte pour un lieu.
 *
 * Avec des coordonnées, on pointe le point exact ; sinon, une recherche
 * sur le nom du lieu — ce qui reste vrai même si le lieu est mal orthographié.
 */
export function lienCarte(opts: {
  location: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}): string {
  if (typeof opts.latitude === "number" && typeof opts.longitude === "number") {
    return `https://www.openstreetmap.org/?mlat=${opts.latitude}&mlon=${opts.longitude}#map=17/${opts.latitude}/${opts.longitude}`;
  }
  const requete = encodeURIComponent([opts.address, opts.location].filter(Boolean).join(", "));
  return `https://www.openstreetmap.org/search?query=${requete}`;
}

/** Fond de carte intégrable, seulement quand le point est connu. */
export function urlCarteIntegree(latitude: number, longitude: number): string {
  const d = 0.004; // ~400 m de part et d'autre : le quartier, pas la ville
  const bbox = [longitude - d, latitude - d / 2, longitude + d, latitude + d / 2].join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`;
}
