// El Mejor Médico: funciona sin conexión tras la primera visita.
const VERSION = 'emm-v3';
const SHELL = ['./', './index.html', './manifest.webmanifest', './favicon.svg', './pwa-192.png', './pwa-512.png', './apple-touch-icon.png',
  './vendor/three.module.min.js', './vendor/RoomEnvironment.js', './vendor/RoundedBoxGeometry.js', './vendor/GLTFLoader.js', './vendor/SkeletonUtils.js', './vendor/BufferGeometryUtils.js', './modelos/personajes.glb',
  './js/juego.js', './js/escena.js', './js/datos.js', './js/audio.js', './js/imagenes.js', './js/cirugia.js'];
const FUENTES = /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const propio = url.origin === location.origin;
  if (!propio && !FUENTES.test(req.url)) return;
  // primero la red (para recibir actualizaciones); si no hay conexión, la copia guardada
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copia = res.clone(); caches.open(VERSION).then(c => c.put(req, copia)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
});
