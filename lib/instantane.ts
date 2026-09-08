"use client";

import { idbGet, idbPut, STORES } from "@/lib/offlineDb";

/**
 * Le dernier état connu d'un écran, gardé sur l'appareil.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * L'accueil se calcule en trois à huit secondes : une trentaine
 * d'aller-retours vers une base distante, dont quatre secondes de
 * préambule avant que la première section ne parte. Pendant ce temps,
 * quelqu'un qui revient sur le site regarde des squelettes — alors qu'il
 * a déjà vu cette page, et qu'elle n'a probablement pas changé.
 *
 * L'instantané est ce qu'il a vu la dernière fois. Il s'affiche
 * immédiatement, puis se fait remplacer section par section à mesure que
 * les données fraîches arrivent. Le réseau n'est pas plus rapide ; c'est
 * l'attente qui disparaît.
 *
 * CE N'EST PAS LE CACHE HORS-LIGNE
 *
 * lib/offlineApi.ts garde les réponses d'API pour qu'elles survivent à
 * une coupure : il interroge le réseau d'abord et ne sert le cache qu'en
 * cas d'échec. C'est le bon comportement pour une donnée qu'on veut
 * juste. Ici on veut l'inverse — montrer d'abord, vérifier ensuite — et
 * mélanger les deux politiques dans le même code aurait rendu chacune
 * illisible.
 *
 * CE QU'IL NE FAUT PAS Y METTRE
 *
 * Rien qui doive être exact au moment où on le lit : un solde, un quota,
 * un état de paiement. Un instantané est par définition périmé le temps
 * qu'on le regarde. Il convient à ce qui se contente d'être « à peu près
 * à jour » — une page d'accueil, une liste de nouveautés.
 */

/** Préfixe commun : les instantanés partagent le magasin des réglages. */
const PREFIXE = "instantane:";

/**
 * Au-delà, on préfère les squelettes.
 *
 * Trois jours, et le chiffre est un compromis assumé. Plus court, un
 * usage hebdomadaire ne profiterait jamais du cache. Plus long, on
 * afficherait des « nouveautés » d'un autre mois pendant les deux
 * secondes que dure le rafraîchissement — bref, mais faux.
 */
const AGE_MAX_MS = 3 * 24 * 60 * 60 * 1000;

type Enregistrement = { key: string; valeur: unknown; date: number };

export type Instantane<T> = { valeur: T; date: number };

/**
 * Compose une clé.
 *
 * Le compte en fait partie, et ce n'est pas une précaution de style :
 * plusieurs sections de l'accueil dépendent de qui regarde
 * (recommandations, écoutes récentes). Sans lui, se déconnecter
 * laisserait afficher, une seconde, les suggestions de quelqu'un
 * d'autre sur un appareil partagé.
 */
export function cleInstantane(parties: (string | null | undefined)[]): string {
  return PREFIXE + parties.map((p) => p || "-").join(":");
}

export async function lireInstantane<T>(cle: string): Promise<Instantane<T> | null> {
  try {
    const enregistrement = await idbGet<Enregistrement>(STORES.settings, cle);
    if (!enregistrement) return null;
    if (Date.now() - enregistrement.date > AGE_MAX_MS) return null;
    return { valeur: enregistrement.valeur as T, date: enregistrement.date };
  } catch {
    // Navigation privée, stockage refusé, base corrompue : l'écran se
    // charge normalement, simplement sans raccourci.
    return null;
  }
}

export async function ecrireInstantane(cle: string, valeur: unknown): Promise<void> {
  try {
    await idbPut<Enregistrement>(STORES.settings, { key: cle, valeur, date: Date.now() });
  } catch {
    /* voir ci-dessus : perdre le raccourci ne coûte qu'une attente */
  }
}
