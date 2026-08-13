/** Formate un nombre en notation compacte française (12500 -> "12,5 K"). */
export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
