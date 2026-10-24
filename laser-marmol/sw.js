// Láser sobre Mármol: funciona sin conexión tras la primera visita y recibe fotos compartidas desde la galería.
const VERSION = 'lm-v11';
const SHELL = ['./', './index.html', './manifest.webmanifest', './favicon.svg', './pwa-192.png', './pwa-512.png', './apple-touch-icon.png', './tutorial-poster.jpg'];
const CDN = /^https:\/\/(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== 'lm-share').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  // «Compartir → Láser Mármol» desde la galería del móvil
  if (req.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const form = await req.formData(), file = form.get('image');
        if (file && file.size) await (await caches.open('lm-share')).put('shared-image', new Response(file, { headers: { 'content-type': file.type || 'image/jpeg' } }));
      } catch (err) {}
      return Response.redirect('./?shared=1', 303);
    })());
    return;
  }
  if (req.method !== 'GET') return;
  // la página: primero la red (para recibir mejoras), si no hay conexión la copia guardada
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  // librerías y tipografías con versión fija: primero la copia guardada
  if (CDN.test(req.url) || url.origin === location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      // los vídeos piden trozos (respuesta 206) y esos no se guardan
      if (r.status === 200 || r.type === 'opaque') { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return r;
    })));
  }
});
