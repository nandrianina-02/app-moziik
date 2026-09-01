/**
 * Qui a accès aux fonctions premium, et jusqu'à quand.
 *
 * Une seule fonction fait foi, appelée partout : la page d'accueil, les
 * thèmes personnalisés et « Mon compte » doivent répondre la même chose au
 * même instant.
 */

export type AbonnementLu = {
  status?: string | null;
  /** Absente = sans échéance (accès offert à durée illimitée). */
  currentPeriodEnd?: string | Date | null;
} | null | undefined;

export function hasPremiumAccess(params: {
  role?: string;
  subscription?: AbonnementLu;
}): boolean {
  if (params.role === "admin") return true;

  const abonnement = params.subscription;
  if (abonnement?.status !== "active") return false;

  // L'échéance compte autant que le statut.
  //
  // Elle n'était pas vérifiée : un accès à durée limitée n'aurait donc
  // jamais pris fin, et un paiement mobile — qui écrit `active` une fois
  // pour toutes, sans rien pour le repasser à `expired` — ouvrait le
  // premium indéfiniment.
  if (!abonnement.currentPeriodEnd) return true;
  return new Date(abonnement.currentPeriodEnd).getTime() > Date.now();
}

/** Cet accès a-t-il été offert par l'administration plutôt qu'acheté ? */
export function estOffert(abonnement: { paymentMethod?: string | null } | null | undefined): boolean {
  return abonnement?.paymentMethod === "offert";
}
