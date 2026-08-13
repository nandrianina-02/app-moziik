/**
 * Échappe les métacaractères regex d'une chaîne fournie par l'utilisateur
 * avant de l'utiliser dans un `$regex` MongoDB. Sans ça, une recherche
 * peut lever une erreur (regex invalide) ou, avec un motif pathologique,
 * dégrader les performances de la requête (ReDoS).
 */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
