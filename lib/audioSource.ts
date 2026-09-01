import type { AudioQuality } from "@/lib/offlineSettings";

/**
 * L'adresse par laquelle le navigateur demande un morceau.
 *
 * Toujours la nôtre, jamais celle de Cloudinary : c'est le serveur qui
 * décide de la qualité servie et vérifie le quota (voir
 * `app/api/stream/[id]/route.ts`). Le navigateur ne fait que suivre la
 * redirection.
 *
 * Elle est **stable** pour un titre et une qualité donnés, et c'est
 * volontaire : le cache hors-ligne range les fichiers sous l'adresse
 * demandée, et une adresse qui changerait à chaque session rendrait muet
 * un morceau pourtant téléchargé.
 */
export function adresseEcoute(songId: string, quality: AudioQuality): string {
  return `/api/stream/${songId}?q=${quality}`;
}
