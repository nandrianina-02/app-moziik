import type { AudioQuality } from "@/lib/offlineSettings";

/**
 * Ce que chaque visiteur a le droit de faire.
 *
 * Un seul endroit répond à la question, du serveur comme du navigateur :
 * les limites annoncées sur la page d'abonnement et celles réellement
 * appliquées doivent être les mêmes, et le seul moyen d'en être sûr est
 * qu'elles soient écrites une fois.
 *
 * Volontairement sans mongoose ni React.
 */

export type Visiteur = {
  connecte: boolean;
  premium: boolean;
};

export const VISITEUR_ANONYME: Visiteur = { connecte: false, premium: false };

/**
 * Nombre de titres qu'un visiteur non connecté peut écouter par jour.
 *
 * Assez pour se faire une idée du catalogue, trop peu pour s'en passer.
 * Réglable depuis l'administration ; `0` lève la limite.
 */
export const ECOUTES_ANONYMES_PAR_DEFAUT = 15;

/**
 * Qualité maximale servie.
 *
 * Les comptes gratuits plafonnent à 128 kb/s, les abonnés accèdent au
 * 320 kb/s : c'est ce que « qualité audio supérieure » veut dire sur la
 * page d'abonnement. Le plafond s'applique à l'URL réellement lue
 * (transformation Cloudinary), pas seulement au menu.
 */
export function qualiteMaximale(visiteur: Visiteur): AudioQuality {
  return visiteur.premium ? "high" : "medium";
}

const RANG: Record<AudioQuality, number> = { low: 0, medium: 1, high: 2 };

/** Ramène une qualité choisie sous le plafond du visiteur. */
export function limiterQualite(voulue: AudioQuality, visiteur: Visiteur): AudioQuality {
  const plafond = qualiteMaximale(visiteur);
  return RANG[voulue] > RANG[plafond] ? plafond : voulue;
}

/** Le téléchargement pour écoute hors connexion est réservé aux abonnés. */
export function peutTelechargerHorsLigne(visiteur: Visiteur): boolean {
  return visiteur.premium;
}

/** Thème et couleurs personnalisés : réservés aux abonnés. */
export function peutPersonnaliserTheme(visiteur: Visiteur): boolean {
  return visiteur.premium;
}

/**
 * Les gestes qui laissent une trace sur un compte.
 *
 * Aimer, suivre, commenter, ranger dans une playlist : sans compte, il n'y
 * a nulle part où l'écrire. Ce n'est pas une restriction commerciale, d'où
 * la distinction avec ce qui précède — et d'où le message, qui invite à se
 * connecter plutôt qu'à s'abonner.
 */
export function demandeUnCompte(visiteur: Visiteur): boolean {
  return !visiteur.connecte;
}

/** Ce qu'on répond quand une action est refusée, selon la raison. */
export const MESSAGE_CONNEXION = "Connecte-toi pour faire ça.";
export const MESSAGE_PREMIUM = "Cette fonction est réservée aux abonnés Premium.";
export const MESSAGE_QUOTA_ANONYME =
  "Tu as atteint la limite d'écoute des visiteurs. Crée un compte pour continuer, c'est gratuit.";
