const CACHE_NAME = "risk-assessment-tool-v2";
const BASE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const asset = (path) => `${BASE_PATH}${path}`;
const CORE_ASSETS = [
  asset("/"),
  asset("/index.html"),
  asset("/manifest.webmanifest"),
  asset("/icons/app-icon.jpg"),
  asset("/icons/icon.svg")
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetched = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          if (request.mode === "navigate") return caches.match(asset("/index.html"));
          return cached;
        });
      return cached || fetched;
    })
  );
});
