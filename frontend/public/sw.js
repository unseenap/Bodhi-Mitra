const CACHE_NAME = "bodhi-mitra-v2";
const APP_SHELL = [
  "/",
  "/images/SEO/site.webmanifest",
  "/images/SEO/favicon.svg",
  "/images/SEO/web-app-manifest-192x192.png",
  "/images/SEO/web-app-manifest-512x512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(async cache => {
    await Promise.all(APP_SHELL.map(async url => {
      try {
        const response = await fetch(url, { cache: "reload" });
        if (response.ok) await cache.put(url, response);
      } catch {
        // One optional asset must not prevent service-worker installation.
      }
    }));
  }));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put("/", response.clone()));
      return response;
    }).catch(async () => (await caches.match("/")) || Response.error()));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok && response.type === "basic") caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
    return response;
  })));
});

self.addEventListener("push", event => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch { data = { body: event.data?.text() }; }
  event.waitUntil(self.registration.showNotification(data.title ?? "Bodhi-Mitra", {
    body: data.body,
    icon: "/images/SEO/web-app-manifest-192x192.png",
    badge: "/images/SEO/favicon-96x96.png",
    tag: data.tag,
    data: { url: data.url ?? "/psychologist" }
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url ?? "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(client => client.url.startsWith(self.location.origin));
    if (existing) {
      await existing.focus();
      if ("navigate" in existing) await existing.navigate(targetUrl);
      return;
    }
    await self.clients.openWindow(targetUrl);
  })());
});

