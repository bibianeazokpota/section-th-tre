const CACHE = "presence-pro-v2";
const FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icon.svg"
];

self.addEventListener("install", evt => {
  evt.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));
});
self.addEventListener("fetch", evt => {
  evt.respondWith(caches.match(evt.request).then(resp => resp || fetch(evt.request)));
});
