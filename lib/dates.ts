import { FORMATS_DATE } from "@/lib/locales";

/**
 * Affichage des dates selon les réglages du site.
 *
 * Le format et le fuseau sont choisis en administration ; sans eux, chaque
 * écran décidait pour lui-même (`toLocaleDateString("fr-FR")` un peu
 * partout), et une plateforme réglée sur Antananarivo affichait des dates
 * calculées à Paris — un décalage suffisant pour changer le jour affiché
 * d'une écoute de fin de soirée.
 */

export type ReglagesDate = { dateFormat?: string; timezone?: string; defaultLanguage?: string };

const LOCALE_PAR_LANGUE: Record<string, string> = { fr: "fr-FR", en: "en-US", mg: "fr-MG" };

function partiesDe(date: Date, reglages: ReglagesDate) {
  const locale = LOCALE_PAR_LANGUE[reglages.defaultLanguage ?? "fr"] ?? "fr-FR";
  const options: Intl.DateTimeFormatOptions = {
    timeZone: reglages.timezone || undefined,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  };
  const parties = new Intl.DateTimeFormat(locale, options).formatToParts(date);
  const lire = (type: Intl.DateTimeFormatPartTypes) => parties.find((p) => p.type === type)?.value ?? "";
  return { locale, jour: lire("day"), mois: lire("month"), annee: lire("year") };
}

/** Une date, écrite comme l'administration l'a demandé. */
export function formatDate(valeur: string | number | Date, reglages: ReglagesDate = {}): string {
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return "—";

  const format = FORMATS_DATE.some((f) => f.value === reglages.dateFormat)
    ? (reglages.dateFormat as string)
    : "DD/MM/YYYY";
  const { locale, jour, mois, annee } = partiesDe(date, reglages);

  switch (format) {
    case "MM/DD/YYYY":
      return `${mois}/${jour}/${annee}`;
    case "YYYY-MM-DD":
      return `${annee}-${mois}-${jour}`;
    case "D MMMM YYYY":
      return new Intl.DateTimeFormat(locale, {
        timeZone: reglages.timezone || undefined,
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(date);
    case "DD/MM/YYYY":
    default:
      return `${jour}/${mois}/${annee}`;
  }
}

/** Date et heure, pour les journaux et les fils de discussion. */
export function formatDateHeure(valeur: string | number | Date, reglages: ReglagesDate = {}): string {
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return "—";
  const locale = LOCALE_PAR_LANGUE[reglages.defaultLanguage ?? "fr"] ?? "fr-FR";
  const heure = new Intl.DateTimeFormat(locale, {
    timeZone: reglages.timezone || undefined,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return `${formatDate(date, reglages)} à ${heure}`;
}
