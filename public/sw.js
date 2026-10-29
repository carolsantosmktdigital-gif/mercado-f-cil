const CACHE = "mercado-shell-v14";
const ASSETS = "mercado-assets-v1";
const pages = ["/", "/lista", "/cartoes", "/adicionar", "/historico", "/analise"];
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(CACHE);
      const assets = await caches.open(ASSETS);
      const dependencies = new Set();
      for (const page of pages) {
        const response = await fetch(new Request(page, { cache: "no-store" }));
        if (!response.ok) throw new Error("Não foi possível preparar a nova versão.");
        const html = await response.clone().text();
        for (const match of html.matchAll(/(?:src|href)=["']([^"']*\/assets\/[^"']+)["']/g)) {
          const url = new URL(match[1], self.location.origin);
          if (url.origin === self.location.origin) dependencies.add(url.href);
        }
        await shell.put(page, response);
      }
      // The new shell is activated only after its initial scripts and styles are available offline.
      await Promise.all(
        [...dependencies].map((url) => assets.add(new Request(url, { cache: "reload" }))),
      );
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const assets = await caches.open(ASSETS);
      for (const name of await caches.keys()) {
        if (!name.startsWith("mercado-shell-") || name === CACHE) continue;
        const previous = await caches.open(name);
        // Preserve hashed resources needed by tabs already open, then retire obsolete HTML shells.
        for (const request of await previous.keys()) {
          if (!new URL(request.url).pathname.startsWith("/assets/")) continue;
          const response = await previous.match(request);
          if (response) await assets.put(request, response);
        }
        await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  const asset = url.pathname.startsWith("/assets/");
  const page = event.request.mode === "navigate" && pages.includes(url.pathname);
  if (!asset && !page) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(asset ? ASSETS : CACHE);
      const key = page ? url.pathname : event.request;
      if (asset) {
        const stored = await cache.match(key);
        if (stored) return stored;
      }
      try {
        const response = await fetch(
          page ? new Request(event.request, { cache: "no-store" }) : event.request,
        );
        if (response.ok) await cache.put(key, response.clone());
        return response;
      } catch (error) {
        const stored = (await cache.match(key)) || (page && (await cache.match("/")));
        if (stored) return stored;
        throw error;
      }
    })(),
  );
});
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
    caches.open(ASSETS).then((cache) => Promise.allSettled(urls.map((url) => cache.add(url)))),
  );
});
