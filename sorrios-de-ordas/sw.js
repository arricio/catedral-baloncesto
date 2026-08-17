/* Service worker de Sorríos de Ordás: cachea el juego para poder jugar
   sin conexión una vez instalado en el móvil. */
var CACHE = 'sorrios-de-ordas-v1';
var ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './src/core.js',
  './src/art.js',
  './src/data.js',
  './src/world.js',
  './src/time.js',
  './src/entities.js',
  './src/systems.js',
  './src/render.js',
  './src/ui.js',
  './src/game.js',
  './src/main.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(ASSETS.map(function (u) {
        return c.add(u).catch(function () { /* si falta alguno, seguimos */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); }).catch(function () {});
        return res;
      }).catch(function () { return caches.match('./index.html'); });
    })
  );
});
