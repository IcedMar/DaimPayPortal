const CACHE_NAME = "Daima-Pay-v1";
const urlsToCache = [
  "/",
  "/public/index.html",
  "/public/style.css",
  "/public/script.js",
  "/public/airtel.png",
  "/public/ca-logo.png",
  "/public/cbk-logo.png",
  "/public/email.png",
  "/public/help.html",
  "/public/help.js",
  "/public/loc.png",
  "/public/phone.png",
  "/public/psp.png",
  "/public/saf.png",
  "/public/step1.png",
  "/public/step2.png",
  "/public/step3.png",
  "/public/telkom.jpg",
  "/public/wall.css",
  "/public/wallet.html",
  "/public/wap.png",
  "/public/icons/icon-192.png",
  "/public/icons/icon-512.png"
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
