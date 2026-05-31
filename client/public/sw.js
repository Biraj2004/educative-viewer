const CACHE_NAME = "edu-viewer-cache-v2";

const STATIC_ASSETS = [
  "/",
  "/brand-icon.png",
];

// Install event: cache initial shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log("[Service Worker] Caching static shell");
      await Promise.allSettled(
        STATIC_ASSETS.map(async (asset) => {
          try {
            const response = await fetch(asset, { cache: "no-store" });
            if (response.ok) {
              await cache.put(asset, response);
            }
          } catch {
            // Optional asset; continue install even if unavailable.
          }
        }),
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate event: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("[Service Worker] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: intercept requests
self.addEventListener("fetch", (event) => {
  const request = event.request;
  
  // Only handle GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Ignore webpack HMR / hot reload and dev server assets
  if (
    url.pathname.includes("_next/webpack-hmr") || 
    url.pathname.includes("hot-update") ||
    url.searchParams.has("ts")
  ) {
    return;
  }

  // Ignore API requests, external/internal proxy routes, or authentication paths
  if (
    url.pathname.includes("/api/") || 
    url.pathname.startsWith("/proxy") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    return;
  }

  // Handle static assets (CSS, JS, Fonts, Images)
  const isStaticAsset =
    url.pathname.includes("/_next/static/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".woff");

  if (isStaticAsset) {
    // Cache-First strategy
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return networkResponse;
        }).catch(() => {
          // If offline and not in cache, let it fail
        });
      })
    );
    return;
  }

  // Navigation requests (HTML pages)
  if (request.mode === "navigate") {
    // Network-First strategy
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // Fallback to cache
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Fallback to the root page if not found in cache
            return caches.match("/");
          });
        })
    );
    return;
  }

  // Default: Network-First with cache fallback for other GET requests
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);
      
      return cachedResponse || fetchPromise;
    })
  );
});
