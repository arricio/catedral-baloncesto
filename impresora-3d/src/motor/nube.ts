/**
 * MODO A · Nube gratuita (Hugging Face Spaces con ZeroGPU).
 *
 * Se conecta con @gradio/client a Spaces públicos. Si uno falla o está saturado,
 * prueba el siguiente de la lista. Si el usuario ha iniciado sesión con Hugging Face,
 * se envía su token para que se use SU cupo gratuito (y no el anónimo, que es menor).
 *
 * Los nombres de los endpoints se han leído del código (app.py) de cada Space
 * en octubre de 2026. Si un Space cambia su API, el adaptador falla y se pasa al siguiente.
 */
import type { Client as ClienteGradio } from '@gradio/client'
import { ajustes } from '../lib/ajustes'
import { ErrorMotor, MENSAJES, normalizarError, type AlProgresar, type Etapa, type Motor, type OpcionesImagen3D } from './tipos'

type Archivo = { url?: string; path?: string; orig_name?: string }

interface Contexto {
  cliente: ClienteGradio
  manejarArchivo: (b: Blob) => unknown
  alProgresar: AlProgresar
  signal?: AbortSignal
  servicio: string
}

interface AdaptadorEspacio<E, S> {
  id: string // ID del Space en Hugging Face
  nombre: string
  ejecutar(ctx: Contexto, entrada: E): Promise<S>
}

const semilla = () => Math.floor(Math.random() * 2_147_483_647)

// ── Utilidades ──────────────────────────────────────────────

async function conectar(espacio: string, signal?: AbortSignal): Promise<{ cliente: ClienteGradio; manejarArchivo: (b: Blob) => unknown }> {
  const { Client, handle_file } = await import('@gradio/client')
  const token = ajustes().hfToken
  const opciones = {
    events: ['data', 'status'] as ('data' | 'status')[],
    record_history: false,
    ...(token.startsWith('hf_') ? { token: token as `hf_${string}` } : {}),
  }
  const tiempo = new Promise<never>((_, mal) => setTimeout(() => mal(new Error('timeout: el Space no responde')), 30_000))
  const cancelado = new Promise<never>((_, mal) =>
    signal?.addEventListener('abort', () => mal(new DOMException('cancelado', 'AbortError')), { once: true }),
  )
  const cliente = await Promise.race([Client.connect(espacio, opciones), tiempo, cancelado])
  return { cliente, manejarArchivo: handle_file }
}

/** Descripción de la API de cada Space (se pide una vez por conexión). */
const apis = new WeakMap<ClienteGradio, Promise<Awaited<ReturnType<ClienteGradio['view_api']>> | null>>()

/**
 * Convierte los argumentos con nombre en la lista exacta que espera el Space,
 * según su propia descripción de la API. Así no falla si un parámetro no existe
 * (p. ej. los gr.State, que no se exponen) o si falta alguno (se usa su valor por defecto).
 */
async function adaptarArgumentos(cliente: ClienteGradio, endpoint: string | number, datos: Record<string, unknown> | unknown[]): Promise<Record<string, unknown> | unknown[]> {
  if (Array.isArray(datos) || typeof endpoint === 'number') return datos
  if (!apis.has(cliente)) apis.set(cliente, cliente.view_api().catch(() => null))
  const info = (await apis.get(cliente))?.named_endpoints?.[endpoint]
  if (!info) return datos
  const normal = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '')
  const porNombre = new Map(Object.entries(datos).map(([k, v]) => [normal(k), v]))
  return info.parameters.map((p) => {
    for (const clave of [p.parameter_name, p.label]) {
      if (clave && porNombre.has(normal(clave))) return porNombre.get(normal(clave))
    }
    return p.parameter_has_default ? p.parameter_default : null
  })
}

/**
 * Ejecuta un endpoint escuchando la cola y el progreso.
 * `desde`/`hasta` reparten el porcentaje global entre varias llamadas.
 */
async function llamar(ctx: Contexto, endpoint: string | number, datos: Record<string, unknown> | unknown[], etapa: Etapa, desde: number, hasta: number): Promise<unknown[]> {
  if (ctx.signal?.aborted) throw new DOMException('cancelado', 'AbortError')
  const trabajo = ctx.cliente.submit(endpoint, await adaptarArgumentos(ctx.cliente, endpoint, datos))
  const alAbortar = () => trabajo.cancel()
  ctx.signal?.addEventListener('abort', alAbortar, { once: true })
  try {
    for await (const msg of trabajo) {
      if (msg.type === 'status') {
        if (msg.stage === 'error') throw new Error(typeof msg.message === 'string' ? msg.message : `Error en ${endpoint}`)
        if (msg.stage === 'pending' && msg.queue && (msg.position ?? 0) > 0) {
          ctx.alProgresar({ etapa: 'cola', porcentaje: desde, posicionCola: msg.position, eta: msg.eta, servicio: ctx.servicio })
        } else if (msg.stage === 'generating' || msg.stage === 'pending') {
          const pd = msg.progress_data?.find((p) => p.progress != null || (p.index != null && p.length))
          const frac = pd ? (pd.progress ?? (pd.index! + 1) / (pd.length || 1)) : 0.15
          ctx.alProgresar({ etapa, porcentaje: desde + (hasta - desde) * Math.min(1, frac), eta: msg.eta, servicio: ctx.servicio, detalle: pd?.desc ?? undefined })
        }
      } else if (msg.type === 'data') {
        ctx.alProgresar({ etapa, porcentaje: hasta, servicio: ctx.servicio })
        return msg.data as unknown[]
      }
    }
    throw new Error(`El Space no devolvió resultado en ${endpoint}`)
  } finally {
    ctx.signal?.removeEventListener('abort', alAbortar)
  }
}

/** Busca dentro de la respuesta un archivo cuya ruta termine en alguna de las extensiones. */
function buscarArchivo(datos: unknown, extensiones: string[]): Archivo | undefined {
  const pila: unknown[] = [datos]
  while (pila.length) {
    const x = pila.pop()
    if (!x || typeof x !== 'object') continue
    const a = x as Archivo
    const ruta = (a.url ?? a.path ?? a.orig_name ?? '').toLowerCase().split('?')[0]
    if ((a.url || a.path) && extensiones.some((e) => ruta.endsWith(e))) return a
    pila.push(...Object.values(x as Record<string, unknown>))
  }
}

async function descargar(a: Archivo | undefined, signal?: AbortSignal): Promise<Blob> {
  if (!a?.url) throw new Error('El Space no devolvió el archivo')
  const r = await fetch(a.url, { signal })
  if (!r.ok) throw new Error(`Descarga fallida (${r.status})`)
  return r.blob()
}

// ── Adaptadores imagen → 3D ─────────────────────────────────

type Entrada3D = { imagen: Blob; opciones: OpcionesImagen3D }

/** TRELLIS.2 (Microsoft, MIT). Mejor calidad y texturas PBR. */
const trellis2: AdaptadorEspacio<Entrada3D, Blob> = {
  id: 'microsoft/TRELLIS.2',
  nombre: 'TRELLIS.2',
  async ejecutar(ctx, { imagen, opciones }) {
    const rapido = opciones.detalle === 'rapido'
    await ctx.cliente.predict('/start_session', []).catch(() => undefined)
    ctx.alProgresar({ etapa: 'analizando', porcentaje: 8, servicio: ctx.servicio })
    const [pre] = await llamar(ctx, '/preprocess_image', { input: ctx.manejarArchivo(imagen) }, 'analizando', 8, 18)
    await llamar(
      ctx,
      '/image_to_3d',
      {
        image: pre,
        seed: semilla(),
        resolution: rapido ? '512' : '1024',
        ss_guidance_strength: 7.5, ss_guidance_rescale: 0.7, ss_sampling_steps: 12, ss_rescale_t: 5,
        shape_slat_guidance_strength: 7.5, shape_slat_guidance_rescale: 0.5, shape_slat_sampling_steps: 12, shape_slat_rescale_t: 3,
        tex_slat_guidance_strength: 1, tex_slat_guidance_rescale: 0, tex_slat_sampling_steps: 12, tex_slat_rescale_t: 3,
      },
      'forma', 18, 70,
    )
    const salida = await llamar(
      ctx, '/extract_glb',
      { decimation_target: rapido ? 100_000 : 250_000, texture_size: rapido ? 1024 : 2048 },
      'texturas', 70, 96,
    )
    return descargar(buscarArchivo(salida, ['.glb']), ctx.signal)
  },
}

/** TRELLIS (versión 1, copia comunitaria con API MCP). Muy fiable. */
const trellis1: AdaptadorEspacio<Entrada3D, Blob> = {
  id: 'trellis-community/TRELLIS',
  nombre: 'TRELLIS',
  async ejecutar(ctx, { imagen, opciones }) {
    const rapido = opciones.detalle === 'rapido'
    await ctx.cliente.predict('/start_session', []).catch(() => undefined)
    const [pre] = await llamar(ctx, '/preprocess_image', { image: ctx.manejarArchivo(imagen) }, 'analizando', 6, 18)
    const salida = await llamar(
      ctx,
      '/generate_and_extract_glb',
      {
        image: pre, multiimages: [], seed: semilla(),
        // Más pasos en modo detallado = más fiel a la foto (cara, letras).
        ss_guidance_strength: 7.5, ss_sampling_steps: rapido ? 12 : 20,
        slat_guidance_strength: 3, slat_sampling_steps: rapido ? 12 : 20,
        multiimage_algo: 'stochastic',
        mesh_simplify: rapido ? 0.96 : 0.9,
        texture_size: rapido ? 1024 : 2048,
      },
      'forma', 18, 96,
    )
    return descargar(buscarArchivo(salida, ['.glb']), ctx.signal)
  },
}

/**
 * Stable Fast 3D (Stability AI). Muy rápido; licencia comunitaria gratuita.
 * Su API pública no permite pedirle que quite el fondo, así que solo se usa
 * con imágenes que ya lo traen quitado (opción «Quitar el fondo en mi dispositivo»).
 */
const sf3d: AdaptadorEspacio<Entrada3D, Blob> = {
  id: 'stabilityai/stable-fast-3d',
  nombre: 'Stable Fast 3D',
  async ejecutar(ctx, { imagen }) {
    if (imagen.type !== 'image/png') throw new Error('Stable Fast 3D necesita una imagen sin fondo')
    const img = ctx.manejarArchivo(imagen)
    await llamar(ctx, '/requires_bg_remove', { image: img, fr: 0.85 }, 'analizando', 6, 15)
    const salida = await llamar(
      ctx, '/run_button',
      { run_btn: 'Run', input_image: img, foreground_ratio: 0.85, remesh_option: 'None', vertex_count: -1, texture_size: 1024 },
      'forma', 15, 96,
    )
    return descargar(buscarArchivo(salida, ['.glb']), ctx.signal)
  },
}

/**
 * Con cuenta y calidad «Detallada»: primero TRELLIS.2 (el más fiel a la foto).
 * Con calidad «Rápida»: primero TRELLIS, que hace una sola reserva de GPU y gasta menos cupo.
 */
/**
 * PSHuman (Universidad de Fudan, licencia MIT): especializada en PERSONAS. Reconstruye la
 * figura entera (cara, nuca, espalda) a partir de una sola foto, cuidando sobre todo la cara.
 * Devuelve un OBJ con colores por vértice, que aquí se convierte a GLB.
 * El autor del Space ocultó la API (show_api=False): se prueba por nombre y, si no, por posición.
 */
const pshuman: AdaptadorEspacio<Entrada3D, Blob> = {
  id: 'fffiloni/PSHuman',
  nombre: 'PSHuman (personas)',
  async ejecutar(ctx, { imagen }) {
    ctx.alProgresar({ etapa: 'analizando', porcentaje: 6, servicio: ctx.servicio, detalle: 'Analizando a la persona' })
    const datos = [ctx.manejarArchivo(imagen), true]
    let salida: unknown[]
    try {
      salida = await llamar(ctx, '/process_image', datos, 'forma', 8, 90)
    } catch (e) {
      if (normalizarError(e).tipo === 'cupo') throw e
      salida = await llamar(ctx, 0, datos, 'forma', 8, 90)
    }
    ctx.alProgresar({ etapa: 'texturas', porcentaje: 92, servicio: ctx.servicio, detalle: 'Preparando la figura' })
    // Dos OBJ: uno solo forma y otro con color. Nos quedamos con el que trae colores.
    const objs: Archivo[] = []
    const pila: unknown[] = [salida]
    while (pila.length) {
      const x = pila.pop()
      if (!x || typeof x !== 'object') continue
      const a = x as Archivo
      if ((a.url ?? a.path ?? '').toLowerCase().split('?')[0].endsWith('.obj')) objs.push(a)
      else pila.push(...Object.values(x as Record<string, unknown>))
    }
    if (!objs.length) throw new Error('PSHuman no devolvió la figura')
    let mejor = ''
    for (const a of objs) {
      const texto = await (await descargar(a, ctx.signal)).text()
      const conColor = /^v\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+/m.test(texto)
      if (conColor || !mejor) mejor = texto
      if (conColor) break
    }
    const { objAGlb } = await import('../exportar/formatos')
    return objAGlb(mejor)
  },
}

export const ESPACIOS_3D = [trellis2, trellis1, sf3d]
/** Para personas: primero la IA especializada; si falla, las generales. */
const ESPACIOS_PERSONA = [pshuman, trellis2, trellis1]
const ESPACIOS_3D_RAPIDO = [trellis1, trellis2, sf3d]
const ESPACIOS_3D_SIN_SESION = [sf3d, trellis1, trellis2]

// ── Adaptadores texto → imagen ──────────────────────────────

const flux = (id: string, nombre: string): AdaptadorEspacio<string, Blob> => ({
  id,
  nombre,
  async ejecutar(ctx, prompt) {
    const salida = await llamar(
      ctx, '/infer',
      { prompt, seed: semilla(), randomize_seed: true, width: 1024, height: 1024, num_inference_steps: 4 },
      'imagen', 5, 95,
    )
    return descargar(buscarArchivo(salida, ['.png', '.webp', '.jpg', '.jpeg']) ?? (salida[0] as Archivo), ctx.signal)
  },
})

export const ESPACIOS_IMAGEN = [
  flux('black-forest-labs/FLUX.1-schnell', 'FLUX.1 schnell'),
  flux('evalstate/flux1_schnell', 'FLUX.1 schnell (réplica)'),
]

// ── Cadena con reserva ──────────────────────────────────────

/** Spaces que han fallado hace poco: se intentan los últimos durante 10 minutos. */
const fallosRecientes = new Map<string, number>()
const ordenar = <T extends { id: string }>(lista: T[]) =>
  [...lista].sort((a, b) => (fallosRecientes.get(a.id) ?? 0) - (fallosRecientes.get(b.id) ?? 0))

async function conReserva<E, S>(lista: AdaptadorEspacio<E, S>[], entrada: E, alProgresar: AlProgresar, signal?: AbortSignal): Promise<{ salida: S; servicio: string }> {
  const errores: ErrorMotor[] = []
  const detalles: string[] = []
  for (const esp of ordenar(lista)) {
    const servicio = `${esp.nombre} · Nube`
    try {
      alProgresar({ etapa: 'conectando', porcentaje: 2, servicio })
      const { cliente, manejarArchivo } = await conectar(esp.id, signal)
      try {
        const salida = await esp.ejecutar({ cliente, manejarArchivo, alProgresar, signal, servicio }, entrada)
        fallosRecientes.delete(esp.id)
        return { salida, servicio }
      } finally {
        cliente.close()
      }
    } catch (e) {
      const err = normalizarError(e)
      console.warn(`[nube] ${esp.id} falló:`, e)
      if (err.tipo === 'cancelado' || err.tipo === 'red') throw err
      // Aunque un Space diga «cupo», seguimos: cada Space reserva un tiempo de GPU distinto
      // y uno más ligero puede caber en el cupo que queda.
      fallosRecientes.set(esp.id, Date.now())
      errores.push(err)
      detalles.push(`${esp.nombre}: ${err.detalle ?? err.message}`)
    }
  }
  const tipo = errores.some((x) => x.tipo === 'cupo') ? 'cupo' : errores.some((x) => x.tipo === 'saturado') ? 'saturado' : 'desconocido'
  throw new ErrorMotor(tipo, MENSAJES[tipo], detalles.join(' · '))
}

export const motorNube: Motor = {
  id: 'nube',
  nombre: 'Nube gratuita',
  async textoAImagen(prompt, alProgresar, signal) {
    const { salida, servicio } = await conReserva(ESPACIOS_IMAGEN, prompt, alProgresar, signal)
    return { imagen: salida, servicio }
  },
  async imagenA3D(imagen, opciones, alProgresar) {
    const lista = !ajustes().hfToken
      ? ESPACIOS_3D_SIN_SESION
      : opciones.tipo === 'persona'
        ? ESPACIOS_PERSONA
        : opciones.detalle === 'rapido'
          ? ESPACIOS_3D_RAPIDO
          : ESPACIOS_3D
    const { salida, servicio } = await conReserva(lista, { imagen, opciones }, alProgresar, opciones.signal)
    return { glb: salida, servicio }
  },
}
