import type { NextResponse } from "next/server";

/**
 * Fait garder une réponse par le réseau de Vercel, une minute, puis dix
 * minutes de plus pendant qu'il la rafraîchit en arrière-plan. Un
 * visiteur reçoit alors la copie sans attendre une fonction, et surtout
 * sans attendre son démarrage à froid ni l'ouverture d'une connexion vers
 * Atlas.
 *
 * RÉSERVÉ AUX RÉPONSES QUI NE DÉPENDENT PAS DU VISITEUR
 *
 * Le réseau de Vercel forme sa clé avec l'adresse, jamais avec les
 * cookies, et il sert la copie à tous. Une route qui lit la session,
 * l'univers choisi ou toute autre préférence ne doit pas passer ici : la
 * copie d'un visiteur serait servie à un autre. Fiche artiste et fiche
 * album sont les mêmes pour tout le monde ; l'accueil, les classements et
 * les listes de titres ne le sont pas.
 */
export const DUREE_CACHE_S = 60;
export const DUREE_PERIMEE_S = 600;

export function cachePublic<T extends NextResponse>(reponse: T): T {
  reponse.headers.set("Cache-Control", `public, s-maxage=${DUREE_CACHE_S}, stale-while-revalidate=${DUREE_PERIMEE_S}`);
  return reponse;
}
