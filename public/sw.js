// Small, hand-written service worker (no build-step precache manifest — Next.js's
// static asset filenames are content-hashed per deploy, so this caches them as
// they're actually requested instead of trying to predict them).
//
// Strategy: network-first, falling back to whatever was cached last time, for every
// same-origin GET request (pages, the RSC data Next.js's client router fetches on
// navigation, and static JS/CSS/icons alike). This is what makes "open the installed
// app with no signal" and "the active workout survives a refresh with no signal"
// work — only the page shell and previously-visited screens are covered; Supabase
// calls are a different origin, so this never touches saving/loading real data.
//
// Bump CACHE_NAME (any change to the string) to force everyone's old cache to be
// dropped after the next deploy.
const CACHE_NAME = "workout-tracker-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return; // Never cache RPC/writes.
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Never touch Supabase calls.

  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const shell = await cache.match("/");
      if (shell) return shell;
    }
    throw err;
  }
}
