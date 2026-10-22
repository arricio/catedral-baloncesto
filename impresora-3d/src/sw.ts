/// <reference lib="webworker" />
/**
 * Service Worker de IMPRESORA 3D.
 * - Precachea la app → se abre sin conexión (la biblioteca vive en IndexedDB).
 * - Recibe notificaciones Web Push del servidor local («¡Tu modelo está listo!»).
 * - Al pulsar la notificación abre la app en el modelo.
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Todas las navegaciones sirven index.html (la app usa rutas con #).
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// Fuentes y recursos estáticos externos: caché primero.
registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({ cacheName: 'fuentes', plugins: [new ExpirationPlugin({ maxEntries: 20 })] }),
)

self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// ── Notificaciones push (servidor local) ──
self.addEventListener('push', (e) => {
  let datos: { titulo?: string; cuerpo?: string; url?: string } = {}
  try {
    datos = e.data?.json() ?? {}
  } catch {
    datos = { cuerpo: e.data?.text() }
  }
  const icono = new URL('pwa-192.png', self.registration.scope).href
  e.waitUntil(
    self.registration.showNotification(datos.titulo ?? '¡Tu modelo 3D está listo! 🎉', {
      body: datos.cuerpo ?? 'Abre IMPRESORA 3D para verlo.',
      icon: icono,
      badge: icono,
      tag: 'impresora3d-listo',
      data: { url: datos.url ?? '#/imprimir' },
    }),
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const destino = new URL(self.registration.scope)
  destino.hash = String(e.notification.data?.url ?? '#/imprimir').replace(/^#/, '')
  e.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const v of ventanas) {
        if (v.url.startsWith(self.registration.scope)) {
          await v.focus()
          return (v as WindowClient).navigate(destino.href)
        }
      }
      return self.clients.openWindow(destino.href)
    })(),
  )
})
