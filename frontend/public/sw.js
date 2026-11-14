// Service worker ndogo kwa ajili ya kuruhusu app kuinstall.
// Haihifadhi (cache) chochote, kwa hiyo data ya zamani haitatokea.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
