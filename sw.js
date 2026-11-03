/* Docky caches application code only. Document data stays in IndexedDB. */
const CACHE_VERSION = 'docky-shell-4a687e5568fc558a';
const APP_BASE = "/dockey-pages/";
// The production build injects every generated application asset here.
const PRECACHE_ASSETS = ["/dockey-pages/","/dockey-pages/assets/index-CIWxboIB.js","/dockey-pages/assets/index-Df893YXv.css","/dockey-pages/favicon.svg","/dockey-pages/icons/apple-touch-icon.png","/dockey-pages/icons/icon-192.png","/dockey-pages/icons/icon-512.png","/dockey-pages/icons/icon-maskable-512.png","/dockey-pages/icons/icon.svg","/dockey-pages/index.html","/dockey-pages/manifest.webmanifest"];
const CACHE_PREFIX = `docky-shell-${encodeURIComponent(APP_BASE)}-`;
const SHELL_CACHE = `${CACHE_PREFIX}${CACHE_VERSION.replace(/^docky-shell-/, '')}-app`;
const CORE_FILES = new Set(
  PRECACHE_ASSETS.map((path) => new URL(path, self.location.origin).pathname),
);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_ASSETS)));
  // An installed update waits for the user's Update action.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== SHELL_CACHE)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(APP_BASE)) return;
  // Hosted sign-in routes belong to Sites and must reach its access gate.
  if (
    ['/signin-with-chatgpt', '/signout-with-chatgpt', '/callback'].some(
      (path) => url.pathname === path || url.pathname.startsWith(`${path}/`),
    )
  )
    return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        // Keep HTML and its hashed assets from the same release until Update.
        const cache = await caches.open(SHELL_CACHE);
        const shell = await cache.match(`${APP_BASE}index.html`);
        if (shell) return shell;
        try {
          const response = await fetch(request);
          if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
            await cache.put(`${APP_BASE}index.html`, response.clone());
          }
          return response;
        } catch {
          return new Response(
            'Docky is not available offline yet. Open it once while connected, then try again.',
            { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
          );
        }
      })(),
    );
    return;
  }

  // Cache only known shell files. No uploaded documents, API responses, or arbitrary URLs.
  if (!CORE_FILES.has(url.pathname)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(url.pathname);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') await cache.put(url.pathname, response.clone());
      return response;
    })(),
  );
});
