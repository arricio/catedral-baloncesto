/**
 * Notificaciones "¡Tu modelo está listo!".
 * - Con la app abierta o en segundo plano: notificación local del Service Worker.
 * - Con la app cerrada (solo Modo B): el servidor local envía una notificación Web Push.
 *   En iPhone solo funcionan si la app está instalada en la pantalla de inicio (iOS 16.4+).
 */
import { soportaNotificaciones } from './plataforma'

export async function pedirPermisoNotificaciones(): Promise<boolean> {
  if (!soportaNotificaciones()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  return (await Notification.requestPermission()) === 'granted'
}

export async function notificar(titulo: string, cuerpo: string, url = '#/biblioteca') {
  if (!soportaNotificaciones() || Notification.permission !== 'granted') return
  // Si la app está a la vista no hace falta molestar.
  if (document.visibilityState === 'visible') return
  try {
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification(titulo, {
      body: cuerpo,
      icon: `${import.meta.env.BASE_URL}pwa-192.png`,
      badge: `${import.meta.env.BASE_URL}pwa-192.png`,
      tag: 'impresora3d-listo',
      data: { url },
    })
  } catch {
    new Notification(titulo, { body: cuerpo })
  }
}

function base64AUint8(base64: string): Uint8Array<ArrayBuffer> {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4)
  const b = atob((base64 + relleno).replace(/-/g, '+').replace(/_/g, '/'))
  const salida = new Uint8Array(new ArrayBuffer(b.length))
  for (let i = 0; i < b.length; i++) salida[i] = b.charCodeAt(i)
  return salida
}

/** Suscripción Web Push para el servidor local (null si no hay permiso o soporte). */
export async function suscripcionPush(urlServidor: string): Promise<PushSubscriptionJSON | null> {
  if (!soportaNotificaciones() || Notification.permission !== 'granted' || !('PushManager' in window)) return null
  const reg = await navigator.serviceWorker.ready
  const r = await fetch(`${urlServidor}/api/push/clave`, { signal: AbortSignal.timeout(4000) })
  if (!r.ok) return null
  const { clave_publica } = (await r.json()) as { clave_publica: string }
  const clave = base64AUint8(clave_publica)
  let sub = await reg.pushManager.getSubscription()
  // Si la suscripción es de otro servidor (otra clave), se renueva.
  const actual = sub?.options.applicationServerKey
  if (sub && actual && new Uint8Array(actual).toString() !== clave.toString()) {
    await sub.unsubscribe()
    sub = null
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: clave })
  return sub.toJSON()
}
