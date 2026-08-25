"use client";

/**
 * Cache hors-ligne des réponses /api, posé côté page.
 *
 * Pourquoi ici et pas dans le service worker : une réponse d'API dépend du
 * compte connecté, et un service worker ne sait pas qui l'est. Sur un
 * appareil partagé, il resservirait après déconnexion les données du compte
 * précédent — c'est la raison pour laquelle public/sw.js exclut /api/ et
 * doit continuer à l'exclure. Ici, la page connaît l'identifiant du compte :
 * chaque entrée en est préfixée, donc un compte ne peut jamais lire le cache
 * d'un autre.
 *
 * Le principe est « réseau d'abord » : en ligne, rien ne change, l'écriture
 * en cache se fait après coup. Hors-ligne, la dernière réponse connue est
 * rendue telle quelle, avec l'en-tête X-Moziik-Cache pour que l'appelant
 * puisse le signaler à l'utilisateur.
 *
 * L'interception passe par window.fetch plutôt que par la modification des
 * 47 fichiers qui appellent /api : une seule couche, et toute route ajoutée
 * plus tard en bénéficie sans y penser.
 */

import { idbDelete, idbGet, idbGetAll, idbPut, STORES } from "@/lib/offlineDb";

export type EntreeApiCache = {
  cle: string;
  url: string;
  utilisateur: string;
  corps: string;
  statut: number;
  enregistreLe: number;
};

const EN_TETE_CACHE = "X-Moziik-Cache";
/** Durée au-delà de laquelle une réponse en cache n'est plus resservie. */
const PEREMPTION_MS = 30 * 24 * 60 * 60 * 1000;

const CLE_DERNIER_COMPTE = "moziik-dernier-compte";

/**
 * Compte auquel rattacher les entrées.
 *
 * Il est relu du stockage local au démarrage, avant même que NextAuth
 * n'ait répondu : hors-ligne, /api/auth/session échoue, la session ne se
 * résout jamais, et sans cette mémoire le cache serait introuvable au
 * moment précis où il sert. L'isolation tient quand même, parce que la
 * valeur est effacée à la déconnexion (voir oublierCompte).
 */
let utilisateurCourant = "anonyme";
if (typeof window !== "undefined") {
  try {
    utilisateurCourant = window.localStorage.getItem(CLE_DERNIER_COMPTE) || "anonyme";
  } catch {
    /* stockage refusé : on reste sur « anonyme » */
  }
}

/**
 * Tant que la session n'est pas résolue, on n'ÉCRIT rien : le cookie part
 * avec la requête même si la page ignore encore qui est connecté, donc une
 * entrée rangée sous « anonyme » pourrait contenir des données de compte.
 * Les réponses reçues entre-temps ne sont pas perdues pour autant — elles
 * attendent ici et sont rangées dès l'identité connue. Sans ce report,
 * aucune donnée n'était enregistrée : au rechargement complet d'une page,
 * les requêtes partent toujours avant la résolution de la session.
 */
let comptePret = false;
const enAttente: { url: string; corps: string; statut: number; date: number }[] = [];

let installe = false;
let vraiFetch: typeof fetch | null = null;

/**
 * Routes laissées au réseau :
 * - /api/auth/… hors « session » : csrf, providers, callbacks — ce sont
 *   des mécanismes de connexion, rien à rejouer hors-ligne ;
 * - …/stream : réponses NDJSON lues en flux (voir lib/sectionStream.ts).
 *   Les bufferiser casserait l'affichage progressif ; elles ont déjà un
 *   repli non-streamé, lui, mis en cache.
 *
 * /api/auth/session, en revanche, est mis en cache comme le reste : sans
 * lui, hors-ligne, NextAuth ne résout jamais la session et toutes les
 * pages qui en dépendent affichent « Connecte-toi » à quelqu'un qui l'est.
 * L'entrée est rattachée au compte et effacée à la déconnexion.
 */
function interceptable(url: URL, methode: string): boolean {
  if (methode.toUpperCase() !== "GET") return false;
  if (url.origin !== window.location.origin) return false;
  if (!url.pathname.startsWith("/api/")) return false;
  if (url.pathname.startsWith("/api/auth/") && url.pathname !== "/api/auth/session") return false;
  if (url.pathname.endsWith("/stream")) return false;
  return true;
}

const cleDe = (utilisateur: string, url: URL) => `${utilisateur}|${url.pathname}${url.search}`;

async function ranger(chemin: string, corps: string, statut: number, date: number) {
  await idbPut<EntreeApiCache>(STORES.apiCache, {
    cle: `${utilisateurCourant}|${chemin}`,
    url: chemin,
    utilisateur: utilisateurCourant,
    corps,
    statut,
    enregistreLe: date,
  });
}

async function memoriser(url: URL, reponse: Response) {
  // Seules les réponses JSON complètes sont rejouables telles quelles.
  const type = reponse.headers.get("content-type") ?? "";
  if (!reponse.ok || !type.includes("application/json")) return;
  try {
    const corps = await reponse.clone().text();
    // Une réponse de plusieurs mégaoctets ne mérite pas une place en
    // cache : IndexedDB est partagé avec les morceaux hors-ligne.
    if (corps.length > 2_000_000) return;
    const chemin = `${url.pathname}${url.search}`;
    if (!comptePret) {
      enAttente.push({ url: chemin, corps, statut: reponse.status, date: Date.now() });
      if (enAttente.length > 60) enAttente.shift();
      return;
    }
    await ranger(chemin, corps, reponse.status, Date.now());
  } catch {
    // Quota atteint ou base indisponible : le mode en ligne doit continuer.
  }
}

async function depuisLeCache(url: URL): Promise<Response | null> {
  try {
    const entree = await idbGet<EntreeApiCache>(STORES.apiCache, cleDe(utilisateurCourant, url));
    if (!entree) return null;
    if (Date.now() - entree.enregistreLe > PEREMPTION_MS) return null;
    return new Response(entree.corps, {
      status: entree.statut,
      headers: {
        "Content-Type": "application/json",
        [EN_TETE_CACHE]: String(entree.enregistreLe),
      },
    });
  } catch {
    return null;
  }
}

/**
 * Enregistre à la main une réponse reconstituée.
 *
 * Les sections d'accueil arrivent par un flux NDJSON, jamais bufferisé :
 * son point de repli non-streamé n'est donc appelé QUE si le flux échoue,
 * c'est-à-dire jamais tant qu'on est en ligne — et il ne se retrouvait
 * jamais en cache. Hors-ligne, l'accueil restait vide alors que toutes ses
 * données venaient d'être reçues. La page réassemble ce qu'elle a lu et le
 * range sous l'URL de repli, celle-là même qu'elle interrogera plus tard.
 */
export async function memoriserManuellement(chemin: string, valeur: unknown) {
  try {
    const corps = JSON.stringify(valeur);
    if (corps.length > 2_000_000) return;
    if (!comptePret) {
      enAttente.push({ url: chemin, corps, statut: 200, date: Date.now() });
      return;
    }
    await ranger(chemin, corps, 200, Date.now());
  } catch {
    /* le mode en ligne ne doit pas en souffrir */
  }
}

/** Vrai si la réponse vient du cache hors-ligne et non du réseau. */
export function vientDuCache(reponse: Response): boolean {
  return reponse.headers.has(EN_TETE_CACHE);
}

/** Date d'enregistrement d'une réponse issue du cache, si elle en vient. */
export function dateDuCache(reponse: Response): Date | null {
  const brut = reponse.headers.get(EN_TETE_CACHE);
  return brut ? new Date(Number(brut)) : null;
}

/** Compte auquel rattacher les entrées. À rappeler à chaque changement de session. */
export function definirCompte(identifiant: string | null | undefined) {
  // « Pas de session » au démarrage n'est pas « pas de compte » : NextAuth
  // rapporte cet état chaque fois que /api/auth/session n'aboutit pas, et
  // basculer sur « anonyme » rendrait le cache du compte introuvable. Seule
  // une déconnexion explicite (oublierCompte) efface la mémoire.
  if (!identifiant && utilisateurCourant !== "anonyme") {
    confirmerCompteMemorise();
    return;
  }
  utilisateurCourant = identifiant || "anonyme";
  comptePret = true;
  try {
    window.localStorage.setItem(CLE_DERNIER_COMPTE, utilisateurCourant);
  } catch {
    /* stockage refusé : le cache ne survivra pas au rechargement, sans plus */
  }
  // Range ce qui a été reçu avant que l'identité ne soit connue.
  const lot = enAttente.splice(0, enAttente.length);
  for (const e of lot) ranger(e.url, e.corps, e.statut, e.date).catch(() => undefined);
}

/**
 * Hors-ligne, NextAuth ne peut pas joindre /api/auth/session : la session
 * n'est jamais « authenticated ». Il ne faut surtout pas en conclure que
 * personne n'est connecté et écraser le compte mémorisé — les lectures
 * chercheraient alors sous « anonyme » et ne trouveraient rien, alors que
 * le cache est là. On se contente d'autoriser les écritures sous la clé
 * déjà connue.
 */
export function confirmerCompteMemorise() {
  comptePret = true;
  const lot = enAttente.splice(0, enAttente.length);
  for (const e of lot) ranger(e.url, e.corps, e.statut, e.date).catch(() => undefined);
}

/**
 * Déconnexion : on efface la mémoire du compte ET ses entrées.
 *
 * À n'appeler qu'EN LIGNE. Hors-ligne, /api/auth/session échoue et NextAuth
 * rapporte « unauthenticated » exactement comme après une vraie
 * déconnexion : purger sur ce signal viderait le cache de quelqu'un qui
 * n'a fait que prendre le métro.
 */
export async function oublierCompte() {
  const precedent = utilisateurCourant;
  try {
    window.localStorage.removeItem(CLE_DERNIER_COMPTE);
  } catch {
    /* rien à effacer */
  }
  utilisateurCourant = "anonyme";
  comptePret = true;
  if (precedent !== "anonyme") await viderCacheApi(precedent).catch(() => 0);
}

/** Supprime tout ce qui a été mis en cache pour un compte donné. */
export async function viderCacheApi(utilisateur?: string): Promise<number> {
  const cible = utilisateur ?? utilisateurCourant;
  const toutes = await idbGetAll<EntreeApiCache>(STORES.apiCache);
  const aSupprimer = toutes.filter((e) => e.utilisateur === cible);
  for (const e of aSupprimer) await idbDelete(STORES.apiCache, e.cle);
  return aSupprimer.length;
}

/** Nombre de réponses actuellement disponibles hors-ligne pour ce compte. */
export async function compterCacheApi(): Promise<number> {
  const toutes = await idbGetAll<EntreeApiCache>(STORES.apiCache);
  return toutes.filter((e) => e.utilisateur === utilisateurCourant).length;
}

export function installerCacheApi() {
  if (installe || typeof window === "undefined") return;
  installe = true;
  vraiFetch = window.fetch.bind(window);

  window.fetch = async (entree: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const appel = vraiFetch as typeof fetch;
    let url: URL;
    const methode = init?.method ?? (entree instanceof Request ? entree.method : "GET");
    try {
      const brut = entree instanceof Request ? entree.url : String(entree);
      url = new URL(brut, window.location.origin);
    } catch {
      return appel(entree as RequestInfo, init);
    }

    if (!interceptable(url, methode)) return appel(entree as RequestInfo, init);

    try {
      const reponse = await appel(entree as RequestInfo, init);
      // Une erreur serveur ne remplace pas une réponse valide déjà connue.
      if (!reponse.ok) {
        const cache = await depuisLeCache(url);
        if (cache && reponse.status >= 500) return cache;
        return reponse;
      }
      memoriser(url, reponse);
      return reponse;
    } catch (err) {
      const cache = await depuisLeCache(url);
      if (cache) return cache;
      throw err;
    }
  };
}
