// L'API ne renseigne qu'une date de début pour un évènement (pas de
// date de fin). On dérive donc un statut temporel purement côté
// affichage, à partir de l'heure actuelle — aucune donnée n'est
// inventée, seul son horodatage est comparé à "maintenant".
//
// Fenêtre "en cours" : un évènement est considéré comme démarré et
// pas encore terminé pendant les 6h qui suivent son heure de début,
// une durée raisonnable pour un concert/soirée type.
const LIVE_WINDOW_HOURS = 6;

export type EventTimeStatus = "upcoming" | "live" | "past";

export function getEventTimeStatus(date: string | Date, now: Date = new Date()): EventTimeStatus {
  const start = new Date(date).getTime();
  const end = start + LIVE_WINDOW_HOURS * 60 * 60 * 1000;
  const t = now.getTime();
  if (t < start) return "upcoming";
  if (t <= end) return "live";
  return "past";
}

export function formatRelativeCountdown(date: string | Date, now: Date = new Date()): string {
  const diffMs = new Date(date).getTime() - now.getTime();
  const diffH = diffMs / (1000 * 60 * 60);

  if (diffH < 0) return "Terminé";
  if (diffH < 1) return "Dans moins d'1h";
  if (diffH < 24) return `Dans ${Math.round(diffH)}h`;
  const diffDays = Math.round(diffH / 24);
  if (diffDays === 1) return "Demain";
  if (diffDays < 30) return `Dans ${diffDays} jours`;
  const diffMonths = Math.round(diffDays / 30);
  return `Dans ${diffMonths} mois`;
}
