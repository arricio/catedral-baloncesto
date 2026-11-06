// La Catedral del Triple: funciona sin conexión tras la primera visita.
const VERSION = 'cdt-v37';
const SHELL = ['./', './index.html', './manifest.webmanifest', './favicon.png', './apple-touch-icon.png',
  ...Array.from({ length: 13 }, (_, i) => './img/p' + String(i + 1).padStart(2, '0') + '.webp'),
  './img/camiseta.webp', './img/bandera.webp', './img/pd1.webp', './img/pd2.webp', './img/ui_fondo.webp', './img/ui_panel.webp', './img/ui_marco.webp', './img/ui_cartel.webp', './img/ui_cancha.webp', './img/cancha.webp', './img/balon.webp', './img/canasta.webp', './img/mate.webp', './audio/av1.mp3', './audio/av2.mp3', './audio/av3.mp3', './audio/av4.mp3', './audio/premio.mp3'];
const FONTS = /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//;
self.addEventListener('install', e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys()
  .then(k => Promise.all(k.filter(x => x !== VERSION).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  // la página: primero la red (para recibir mejoras); sin conexión, la copia guardada
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req, { cache: 'no-store' }).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put('./index.html', c)); return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  if (FONTS.test(req.url) || new URL(req.url).origin === location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.status === 200 || r.type === 'opaque') { const c = r.clone(); caches.open(VERSION).then(x => x.put(req, c)); }
      return r;
    })));
  }
});
