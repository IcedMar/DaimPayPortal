const CACHE_NAME = "Daima-Pay-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/airtel.png",
  "/ca-logo.png",
  "/cbk-logo.png",
  "/email.png",
  "/help.html",
  "/help.js",
  "/loc.png",
  "/phone.png",
  "/psp.png",
  "/saf.png",
  "/step1.png",
  "/step2.png",
  "/step3.png",
  "/telkom.jpg",
  "/wall.css",
  "/wallet.html",
  "/wap.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

// Install SW and cache static files
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("Opened cache");
      return cache.addAll(urlsToCache);
    })
  );
});

// Serve from cache, fallback to network
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

// Update SW and clean old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      )
    )
  );
});
