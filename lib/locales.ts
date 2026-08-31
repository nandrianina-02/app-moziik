/**
 * Les catalogues des réglages régionaux : langue, devise, fuseau, format de
 * date. Ils vivent ici plutôt que dans l'écran d'administration parce que
 * l'affichage des dates et des montants s'en sert aussi (lib/dates.ts,
 * lib/prix.ts) — la liste et son usage doivent rester d'accord.
 *
 * Volontairement courts : mieux vaut une poignée de choix pertinents pour
 * une plateforme malgache et francophone qu'un menu de six cents fuseaux.
 */

export const LANGUES = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
  { value: "mg", label: "Malagasy" },
];

export const DEVISES = [
  { value: "EUR", label: "EUR (€)", symbole: "€", locale: "fr-FR" },
  { value: "USD", label: "USD ($)", symbole: "$", locale: "en-US" },
  { value: "MGA", label: "MGA (Ar)", symbole: "Ar", locale: "fr-MG" },
];

export const FUSEAUX = [
  { value: "Indian/Antananarivo", label: "(UTC+03:00) Antananarivo" },
  { value: "Europe/Paris", label: "(UTC+01:00) Europe/Paris" },
  { value: "Africa/Nairobi", label: "(UTC+03:00) Africa/Nairobi" },
  { value: "UTC", label: "(UTC+00:00) Temps universel" },
  { value: "America/New_York", label: "(UTC−05:00) America/New_York" },
];

export const FORMATS_DATE = [
  { value: "DD/MM/YYYY", label: "31/12/2025" },
  { value: "MM/DD/YYYY", label: "12/31/2025" },
  { value: "YYYY-MM-DD", label: "2025-12-31" },
  { value: "D MMMM YYYY", label: "31 décembre 2025" },
];

export function deviseDe(code: string) {
  return DEVISES.find((d) => d.value === code) ?? DEVISES[0];
}
