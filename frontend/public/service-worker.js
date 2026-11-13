const isLocalRuntime = ["localhost", "127.0.0.1", "::1"].includes(self.location.hostname);

if (isLocalRuntime) {
  self.addEventListener("install", (event) => {
    event.waitUntil(self.skipWaiting());
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.matchAll({ type: "window", includeUncontrolled: true }))
        .then((clients) => clients.forEach((client) => client.navigate(client.url)))
        .catch(() => {}),
    );
  });
} else {
const CACHE_NAME = "fest-a-shell-v2";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/offline.html",
  "/favicon.png",
  "/pwa-192.png",
  "/pwa-512.png",
  "/apple-touch-icon.png",
  "/staff.webmanifest",
  "/pwa-staff-192.png",
  "/pwa-staff-512.png",
  "/apple-touch-icon-staff.png",
  "/images/offline-state.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (request.method !== "GET") {
    return;
  }

  const acceptsHtml = request.headers.get("accept")?.includes("text/html");
  const isApi = isSameOrigin && url.pathname.startsWith("/api/");
  const isStream = isSameOrigin && url.pathname.startsWith("/stream/");
  const isUpload = isSameOrigin && url.pathname.startsWith("/uploads/");
  const isMapTile = url.hostname.endsWith("tile.openstreetmap.org");
  const isBuildAsset = isSameOrigin && url.pathname.startsWith("/assets/");
  const isAppShellAsset = isSameOrigin && APP_SHELL.includes(url.pathname);

  if (!isSameOrigin || isApi || isStream || isUpload || isMapTile) {
    return;
  }

  if (acceptsHtml) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match("/offline.html");
        }),
    );
    return;
  }

  if (!isBuildAsset && !isAppShellAsset) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => Response.error());
    }),
  );
});
}
