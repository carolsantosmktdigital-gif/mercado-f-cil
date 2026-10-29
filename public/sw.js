const CACHE = "mercado-shell-v12";
const pages = ["/", "/lista", "/cartoes", "/adicionar", "/historico", "/analise"];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(pages))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  const asset = url.pathname.startsWith("/assets/");
  const page = event.request.mode === "navigate" && pages.includes(url.pathname);
  if (!asset && !page) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cacheKey = page ? url.pathname : event.request;
      if (asset) {
        const stored = await cache.match(event.request);
        if (stored) return stored;
      }
      try {
        const response = await fetch(event.request);
        if (response.ok) await cache.put(cacheKey, response.clone());
        return response;
      } catch (error) {
        const stored = (await cache.match(cacheKey)) || (page && (await cache.match("/")));
        if (stored) return stored;
        throw error;
      }
    })(),
  );
});
// Cache assets loaded before this worker took control, on the first visit too.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_ASSETS" || !Array.isArray(event.data.urls)) return;
  const urls = event.data.urls.filter((value) => {
    try {
      const url = new URL(value);
      return url.origin === self.location.origin && url.pathname.startsWith("/assets/");
    } catch {
      return false;
    }
  });
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.allSettled(urls.map((url) => cache.add(url)))),
  );
});
