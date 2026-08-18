/* Service worker: permite jugar sin conexión una vez instalado en el móvil. */
var CACHE = 'sorrios-3d-v1';
var ASSETS = ['./', './index.html', './styles.css', './manifest.webmanifest',
  './vendor/three.min.js',
  './src/util.js', './src/textures.js', './src/data.js', './src/sky.js', './src/terrain.js',
  './src/models.js', './src/actors.js', './src/yunta.js', './src/post.js', './src/farm.js', './src/npcs.js',
  './src/audio.js', './src/input.js', './src/ui.js', './src/game.js', './src/main.js',
  './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(ASSETS.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(function (hit) {
    return hit || fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); }).catch(function () {});
      return res;
    }).catch(function () { return caches.match('./index.html'); });
  }));
});
