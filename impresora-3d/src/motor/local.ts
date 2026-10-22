/**
 * MODO B · Servidor local en tu PC (sin límites), expuesto con Cloudflare Tunnel.
 *
 * El servidor (carpeta servidor-local/) guarda una cola de trabajos en disco:
 * aunque se cierre la app o se bloquee el móvil, el trabajo sigue y el resultado
 * se recoge al volver. API:
 *   GET  /api/estado                     → { ok, version, gpu, vram_gb, modelos, cola }
 *   GET  /api/comprobar          (clave) → 200 si la contraseña es correcta
 *   POST /api/trabajos           (clave) → { id }  (multipart: tipo, imagen | prompt, detalle, push)
 *   GET  /api/trabajos/{id}      (clave) → { estado, etapa, progreso, posicion, eta, error }
 *   GET  /api/trabajos/{id}/resultado    → PNG o GLB
 *   GET  /api/push/clave                 → { clave_publica }  (notificaciones Web Push)
 */
import { ajustes } from '../lib/ajustes'
import { suscripcionPush } from '../lib/notificaciones'
import { ErrorMotor, MENSAJES, normalizarError, type AlProgresar, type Etapa, type Motor } from './tipos'

export interface EstadoServidor {
  ok: boolean
  version?: string
  gpu?: string
  vram_gb?: number
  modelos?: { imagen3d?: string; texto_imagen?: string }
  cola?: number
}

const base = (url = ajustes().localUrl) => url.trim().replace(/\/+$/, '')
const cabeceras = (clave = ajustes().localClave): HeadersInit => ({ Authorization: `Bearer ${clave}` })

/** ¿Está encendido el servidor? Responde en menos de 4 s o se considera apagado. */
export async function comprobarServidor(url = ajustes().localUrl): Promise<EstadoServidor | null> {
  if (!url.trim()) return null
  try {
    const r = await fetch(`${base(url)}/api/estado`, { signal: AbortSignal.timeout(4000), cache: 'no-store' })
    if (!r.ok) return null
    const j = (await r.json()) as EstadoServidor
    return j.ok ? j : null
  } catch {
    return null
  }
}

export async function comprobarClave(url: string, clave: string): Promise<boolean> {
  const r = await fetch(`${base(url)}/api/comprobar`, { headers: cabeceras(clave), signal: AbortSignal.timeout(6000) })
  return r.ok
}

interface EstadoTrabajoRemoto {
  estado: 'cola' | 'procesando' | 'listo' | 'error'
  etapa?: Etapa
  progreso?: number
  posicion?: number
  eta?: number
  error?: string
}

async function crearTrabajo(datos: FormData, signal?: AbortSignal): Promise<string> {
  const push = await suscripcionPush(base()).catch(() => null)
  if (push) datos.append('push', JSON.stringify(push))
  const r = await fetch(`${base()}/api/trabajos`, { method: 'POST', body: datos, headers: cabeceras(), signal })
  if (r.status === 401) throw new ErrorMotor('clave', MENSAJES.clave)
  if (!r.ok) throw new Error(`El servidor respondió ${r.status}`)
  return ((await r.json()) as { id: string }).id
}

const esperar = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((ok, mal) => {
    const t = setTimeout(ok, ms)
    signal?.addEventListener('abort', () => (clearTimeout(t), mal(new DOMException('cancelado', 'AbortError'))), { once: true })
  })

/**
 * Consulta el trabajo hasta que termine y descarga el resultado.
 * Sirve tanto para trabajos nuevos como para retomar uno tras reabrir la app.
 */
export async function esperarTrabajo(id: string, alProgresar: AlProgresar, servicio: string, signal?: AbortSignal): Promise<Blob> {
  let fallos = 0
  for (;;) {
    try {
      const r = await fetch(`${base()}/api/trabajos/${id}`, { headers: cabeceras(), signal, cache: 'no-store' })
      if (r.status === 401) throw new ErrorMotor('clave', MENSAJES.clave)
      if (r.status === 404) throw new ErrorMotor('desconocido', 'El servidor ya no tiene ese trabajo (¿se reinició?). Pulsa «Reintentar».')
      const t = (await r.json()) as EstadoTrabajoRemoto
      fallos = 0
      if (t.estado === 'error') throw new ErrorMotor('desconocido', t.error ? `El servidor dice: ${t.error}` : MENSAJES.desconocido)
      if (t.estado === 'listo') {
        const res = await fetch(`${base()}/api/trabajos/${id}/resultado`, { headers: cabeceras(), signal })
        if (!res.ok) throw new Error(`Descarga fallida (${res.status})`)
        return res.blob()
      }
      alProgresar({
        etapa: t.estado === 'cola' ? 'cola' : (t.etapa ?? 'forma'),
        porcentaje: t.progreso ?? 5,
        posicionCola: t.posicion,
        eta: t.eta,
        servicio,
      })
    } catch (e) {
      if (e instanceof ErrorMotor || (e as Error).name === 'AbortError') throw e
      // Cortes momentáneos (túnel, cambio de wifi a datos): reintentamos un rato.
      if (++fallos > 20) throw normalizarError(e)
    }
    await esperar(document.hidden ? 5000 : 1500, signal)
  }
}

export const motorLocal: Motor = {
  id: 'local',
  nombre: 'Mi servidor',
  async textoAImagen(prompt, alProgresar, signal) {
    const datos = new FormData()
    datos.append('tipo', 'texto-imagen')
    datos.append('prompt', prompt)
    alProgresar({ etapa: 'conectando', porcentaje: 2, servicio: 'Mi servidor' })
    const id = await crearTrabajo(datos, signal)
    return { imagen: await esperarTrabajo(id, alProgresar, 'Mi servidor', signal), servicio: 'Mi servidor' }
  },
  async imagenA3D(imagen, opciones, alProgresar) {
    const datos = new FormData()
    datos.append('tipo', 'imagen-3d')
    datos.append('imagen', imagen, imagen.type === 'image/png' ? 'imagen.png' : 'imagen.jpg')
    datos.append('detalle', opciones.detalle)
    datos.append('quitar_fondo', String(opciones.quitarFondo))
    alProgresar({ etapa: 'conectando', porcentaje: 2, servicio: 'Mi servidor' })
    const id = await crearTrabajo(datos, opciones.signal)
    opciones.alCrearTrabajo?.(id)
    const glb = await esperarTrabajo(id, alProgresar, 'Mi servidor', opciones.signal)
    return { glb, servicio: 'Mi servidor' }
  },
}
