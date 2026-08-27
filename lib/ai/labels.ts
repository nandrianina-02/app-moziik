/**
 * Libellés partagés entre le serveur et le navigateur.
 *
 * Ce fichier n'importe rien. C'est sa raison d'être : lib/ai/moderation.ts
 * tire le SDK du fournisseur et la clé d'API, et une page qui aurait
 * importé ses libellés aurait embarqué tout cela dans le paquet du
 * navigateur. Les motifs vivent donc ici, et le module serveur les
 * reprend.
 */

export const MOTIFS_MODERATION = {
  insulte: "Insulte ou attaque personnelle",
  haine: "Propos haineux (origine, religion, orientation, handicap)",
  harcelement: "Menace, intimidation ou acharnement",
  sexuel: "Contenu sexuel explicite",
  violence: "Appel à la violence",
  spam: "Publicité, arnaque ou message répété",
  donnees: "Coordonnées personnelles exposées",
} as const;

export type MotifModeration = keyof typeof MOTIFS_MODERATION;

export const IDS_MOTIFS = Object.keys(MOTIFS_MODERATION) as MotifModeration[];

/** Libellé court pour une pastille, ou le motif brut s'il est inconnu. */
export function libelleMotif(motif: string): string {
  return (MOTIFS_MODERATION as Record<string, string>)[motif] ?? motif;
}
