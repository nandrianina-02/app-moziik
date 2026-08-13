// Service worker Moziik.
// Stratégie :
// - App shell (pages, assets Next.js) : network-first avec repli cache,
//   pour toujours avoir la version la plus récente en ligne, mais rester
//   utilisable hors-ligne.
// - Fichiers Cloudinary (audio/covers) déjà mis en cache explicitement
//   via "Télécharger pour écoute hors-ligne" : cache-first, ils ne sont
//   jamais re-téléchargés une fois stockés.

const APP_SHELL_CACHE = "moziik-shell-v1";
const OFFLINE_MEDIA_CACHE = "moziik-offline-media"; // même nom que lib/offlineCache.ts

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== APP_SHELL_CACHE && key !== OFFLINE_MEDIA_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Médias Cloudinary : cache-first (ne dépend jamais du réseau une
  // fois téléchargés pour l'écoute hors-ligne).
  if (url.hostname.includes("res.cloudinary.com")) {
    event.respondWith(
      caches.match(request, { cacheName: OFFLINE_MEDIA_CACHE }).then((cached) => {
        return cached || fetch(request);
      })
    );
    return;
  }

  // Reste de l'app : network-first, repli sur le cache si hors-ligne.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
  );
});
