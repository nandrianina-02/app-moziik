// Service worker Moziik.
//
// Correctif central de cette version : les écritures en cache n'étaient
// enveloppées dans aucun `event.waitUntil()`. Le navigateur est libre
// d'arrêter un service worker dès que `respondWith` est résolu — la
// promesse `caches.open(...).then(put)` laissée à elle-même n'aboutissait
// donc jamais. Résultat mesuré : Cache Storage entièrement vide, aucun nom
// de cache créé, et toutes les pages injoignables hors-ligne alors que le
// worker était bien actif et contrôlait la page.
//
// Stratégies :
// - Statiques Next (/_next/static, immuables car versionnés par build) :
//   cache d'abord, réseau seulement au premier accès.
// - Navigations et charges RSC : réseau d'abord, repli sur le cache, puis
//   sur la page d'accueil mise en cache à l'installation.
// - Médias Cloudinary : cache d'abord, jamais retéléchargés une fois
//   enregistrés pour l'écoute hors-ligne.
// - /api/ : jamais mis en cache ICI. Ces réponses dépendent du compte
//   connecté, et un service worker ne sait pas qui est connecté : sur un
//   appareil partagé il resservirait les données du compte précédent.
//   La mise en cache des données se fait côté page, indexée par compte
//   (voir lib/offlineApi.ts).

const VERSION = "v5";
const COQUILLE = `moziik-shell-${VERSION}`;
const PAGES = `moziik-pages-${VERSION}`;
const IMAGES = `moziik-images-${VERSION}`;
const MEDIAS = "moziik-offline-media"; // même nom que lib/offlineCache.ts
const CACHES_CONNUS = [COQUILLE, PAGES, IMAGES, MEDIAS];

/** Nombre de pochettes conservées : au-delà, les plus anciennes sautent. */
const MAX_IMAGES = 300;

// Pré-chargées à l'installation : ce sont les seules réponses dont on est
// sûr de disposer avant toute navigation hors-ligne.
const PRECHARGE = ["/", "/hors-ligne"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    ouvrir(COQUILLE)
      .then((cache) => (cache ? Promise.all(PRECHARGE.map((u) => cache.add(new Request(u)).catch(() => undefined))) : undefined))
      // Une URL absente ne doit pas faire échouer toute l'installation :
      // sans worker installé, il n'y a plus de mode hors-ligne du tout.
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => !CACHES_CONNUS.includes(c)).map((c) => caches.delete(c))))
      .catch(() => undefined)
      .then(() => self.clients.claim())
  );
});

/**
 * Toute lecture ou écriture de cache passe par ici.
 *
 * Cache Storage peut échouer pour des raisons qui n'ont rien à voir avec
 * l'application : navigation privée sur Safari, quota saturé, ou stockage
 * indisponible. Une exception non rattrapée dans un gestionnaire `fetch`
 * fait échouer la NAVIGATION elle-même — la page ne s'affiche plus du tout,
 * en ligne comme hors-ligne. Le cache doit donc toujours pouvoir se dérober
 * en silence.
 */
async function ouvrir(nomCache) {
  try {
    return await caches.open(nomCache);
  } catch {
    return null;
  }
}

async function chercher(nomCache, requete) {
  const cache = await ouvrir(nomCache);
  if (!cache) return null;
  try {
    return (await cache.match(requete)) || null;
  } catch {
    return null;
  }
}

/** Met en cache sans bloquer la réponse, mais en maintenant le worker en vie. */
function memoriser(event, nomCache, requete, reponse) {
  if (!reponse || !reponse.ok || reponse.type === "opaque") return;
  const copie = reponse.clone();
  event.waitUntil(
    ouvrir(nomCache)
      .then((cache) => cache && cache.put(requete, copie))
      .catch(() => undefined)
  );
}

/**
 * Mise en cache pilotée par la page.
 *
 * Un service worker ne met en cache que ce qui lui passe sous les yeux. Or
 * les scripts de Next.js sont servis par le cache HTTP du navigateur : une
 * fois chargés, ils ne sont plus jamais redemandés, donc jamais enregistrés
 * — d'autant qu'à la toute première visite le worker ne contrôle pas encore
 * la page. Résultat mesuré : hors-ligne, le document revenait bien du cache
 * mais son bundle manquait, React n'hydratait pas, et la page restait un
 * squelette sans données alors que celles-ci étaient disponibles.
 *
 * La page, elle, sait exactement ce qu'elle a chargé (Resource Timing) :
 * elle envoie la liste, on complète.
 */
self.addEventListener("message", (event) => {
  const donnees = event.data;
  if (!donnees || donnees.type !== "moziik-precharger" || !Array.isArray(donnees.urls)) return;
  event.waitUntil(
    (async () => {
      const cache = await ouvrir(COQUILLE);
      if (!cache) return;
      for (const url of donnees.urls.slice(0, 200)) {
        try {
          const requete = new Request(url);
          if (await cache.match(requete)) continue;
          const reponse = await fetch(requete);
          if (reponse.ok) await cache.put(requete, reponse);
        } catch {
          /* une ressource manquante n'empêche pas les suivantes */
        }
      }
    })()
  );
});

/**
 * Clé de navigation normalisée.
 *
 * Next.js répond aux pages avec « Vary: RSC, Next-Router-State-Tree… ».
 * Cache Storage respecte Vary : une entrée écrite depuis un préchargement
 * RSC (en-tête « RSC: 1 ») ne répond donc jamais à une navigation
 * ordinaire, et inversement. Mesuré : toutes les pages retombaient sur le
 * repli hors-ligne alors qu'elles avaient bien été visitées. On range donc
 * les documents sous une requête nue, dépourvue de ces en-têtes.
 */
function cleNavigation(url) {
  return new Request(url.origin + url.pathname + url.search);
}

/** Borne le cache d'images : suppression des plus anciennes entrées. */
async function limiterImages() {
  const cache = await ouvrir(IMAGES);
  if (!cache) return;
  try {
    const cles = await cache.keys();
    if (cles.length <= MAX_IMAGES) return;
    await Promise.all(cles.slice(0, cles.length - MAX_IMAGES).map((c) => cache.delete(c)));
  } catch {
    /* rien à purger si le cache est indisponible */
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  if (url.hostname.includes("res.cloudinary.com")) {
    // L'audio (« /video/upload/ » chez Cloudinary) n'est servi hors-ligne
    // que s'il a été explicitement téléchargé : plusieurs mégaoctets par
    // morceau, hors de question de le faire à l'insu de l'utilisateur.
    const estAudio = url.pathname.includes("/video/");
    if (estAudio) {
      event.respondWith(
        chercher(MEDIAS, request).then((c) => c || fetch(request).catch(() => Response.error()))
      );
      return;
    }
    // Les pochettes, elles, pèsent quelques dizaines de kilooctets : les
    // garder au passage évite une page hors-ligne pleine de cadres vides.
    event.respondWith(
      (async () => {
        const dejaTelecharge = await chercher(MEDIAS, request);
        if (dejaTelecharge) return dejaTelecharge;
        const enCache = await chercher(IMAGES, request);
        if (enCache) return enCache;
        try {
          const reponse = await fetch(request);
          memoriser(event, IMAGES, request, reponse);
          event.waitUntil(limiterImages());
          return reponse;
        } catch {
          return Response.error();
        }
      })()
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Données de compte : au réseau, sans repli ici. Hors-ligne, c'est la
  // page qui répond depuis IndexedDB (lib/offlineApi.ts).
  if (url.pathname.startsWith("/api/")) return;

  // Pochettes optimisées par next/image. C'est par là que passent les
  // images de l'application : le navigateur demande /_next/image?url=…,
  // jamais l'URL Cloudinary, si bien que la branche Cloudinary ci-dessus
  // ne les voyait pas et qu'aucune pochette ne survivait hors-ligne.
  // La réponse est déterminée par (url, largeur, qualité) : cache d'abord.
  if (url.pathname === "/_next/image") {
    event.respondWith(
      (async () => {
        const enCache = await chercher(IMAGES, request);
        if (enCache) return enCache;
        try {
          const reponse = await fetch(request);
          memoriser(event, IMAGES, request, reponse);
          event.waitUntil(limiterImages());
          return reponse;
        } catch {
          return Response.error();
        }
      })()
    );
    return;
  }

  // Fichiers de build : immuables, cache d'abord.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      chercher(COQUILLE, request).then((cache) => {
        if (cache) return cache;
        return fetch(request).then((reponse) => {
          memoriser(event, COQUILLE, request, reponse);
          return reponse;
        });
      })
    );
    return;
  }

  // Documents : rangés sous une clé normalisée pour échapper au Vary.
  if (request.mode === "navigate") {
    const cle = cleNavigation(url);
    event.respondWith(
      fetch(request)
        .then((reponse) => {
          memoriser(event, PAGES, cle, reponse);
          return reponse;
        })
        .catch(async () => {
          return (
            (await chercher(PAGES, cle)) ||
            (await chercher(COQUILLE, new Request(self.registration.scope + "hors-ligne"))) ||
            (await chercher(COQUILLE, new Request(self.registration.scope))) ||
            new Response(
              "<!doctype html><meta charset=\"utf-8\"><title>Hors-ligne</title><h1>Hors-ligne</h1><p>Cette page n'a pas encore été enregistrée.</p>",
              { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
            )
          );
        })
    );
    return;
  }

  // Reste : charges RSC, images locales, manifeste — réseau d'abord.
  event.respondWith(
    fetch(request)
      .then((reponse) => {
        memoriser(event, COQUILLE, request, reponse);
        return reponse;
      })
      .catch(async () => (await chercher(COQUILLE, request)) || Response.error())
  );
});
