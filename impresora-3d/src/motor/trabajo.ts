/**
 * Orquestador de la impresión: gestiona el trabajo en curso de principio a fin.
 *
 *  Foto  → comprimir → (quitar fondo en el móvil) → imagen→3D → guardar en biblioteca
 *  Texto → texto→imagen → [el usuario acepta o regenera] → imagen→3D → guardar
 *
 * El trabajo se guarda en IndexedDB en cada paso. Si se cierra la app:
 *  - Modo B (servidor local): al volver se retoma la consulta y se recoge el resultado.
 *  - Modo A (nube): Hugging Face puede cortar la tarea; al volver se reintenta sola.
 */
import { create } from 'zustand'
import { ajustes } from '../lib/ajustes'
import { db, nuevoId, type Estilo, type Trabajo } from '../lib/db'
import { comprimirImagen, crearMiniatura } from '../lib/imagen'
import { notificar } from '../lib/notificaciones'
import { avisar } from '../lib/avisos'
import { elegirMotor } from './index'
import { esperarTrabajo } from './local'
import { construirPrompt, nombreDesdeTexto } from './prompts'
import { ErrorMotor, normalizarError, type Progreso } from './tipos'

interface EstadoImpresion {
  trabajo: Trabajo | null
  progreso: Progreso | null
  error: ErrorMotor | null
  /** Hay que reintentar automáticamente al volver a la app. */
  reintentarAlVolver: boolean
}

export const useImpresion = create<EstadoImpresion>(() => ({
  trabajo: null,
  progreso: null,
  error: null,
  reintentarAlVolver: false,
}))

let controlador: AbortController | null = null
let bloqueoPantalla: { release: () => Promise<void> } | null = null

// ── Utilidades internas ─────────────────────────────────────

async function guardar(cambios: Partial<Trabajo>) {
  const actual = useImpresion.getState().trabajo
  if (!actual) return
  const nuevo = { ...actual, ...cambios }
  useImpresion.setState({ trabajo: nuevo })
  await db.trabajos.put(nuevo)
}

const alProgresar = (p: Progreso) => useImpresion.setState({ progreso: p })

/** Mantiene la pantalla encendida mientras se imprime (si el navegador lo permite). */
async function mantenerPantalla(activar: boolean) {
  try {
    if (activar && !bloqueoPantalla && 'wakeLock' in navigator) {
      bloqueoPantalla = await (navigator as Navigator & { wakeLock: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen')
    } else if (!activar && bloqueoPantalla) {
      await bloqueoPantalla.release()
      bloqueoPantalla = null
    }
  } catch {
    /* sin Wake Lock: no pasa nada */
  }
}

function fallo(e: unknown) {
  const err = normalizarError(e)
  const t = useImpresion.getState().trabajo
  mantenerPantalla(false)
  if (err.tipo === 'cancelado') return
  // Si la conexión se cortó con la app en segundo plano (pantalla bloqueada), reintentamos al volver.
  if (document.hidden && t?.motor === 'nube' && (err.tipo === 'red' || err.tipo === 'saturado' || err.tipo === 'desconocido')) {
    useImpresion.setState({ reintentarAlVolver: true })
    guardar({ estado: 'interrumpido', error: err.message })
    return
  }
  useImpresion.setState({ error: err })
  guardar({ estado: 'error', error: err.message })
  if (err.detalle) console.warn('Detalle del error:', err.detalle)
  notificar('No se pudo imprimir 😕', err.message, '#/imprimir')
}

// ── Pasos ───────────────────────────────────────────────────

async function pasoImagenDesdeTexto() {
  const t = useImpresion.getState().trabajo!
  controlador = new AbortController()
  useImpresion.setState({ error: null, progreso: { etapa: 'conectando', porcentaje: 1 } })
  await guardar({ estado: 'imagen', error: undefined })
  mantenerPantalla(true)
  try {
    const { motor, aviso } = await elegirMotor()
    if (aviso) avisar(aviso, 'info')
    await guardar({ motor: motor.id })
    const prompt = construirPrompt(t.prompt!, t.estilo ?? 'realista', t.colores)
    const { imagen } = await motor.textoAImagen(prompt, alProgresar, controlador.signal)
    await guardar({ estado: 'aprobar', imagen })
    useImpresion.setState({ progreso: null })
    mantenerPantalla(false)
    notificar('Imagen lista ✨', 'Revisa la imagen y pulsa «Crear modelo 3D».', '#/imprimir')
  } catch (e) {
    fallo(e)
  }
}

async function paso3D() {
  const t = useImpresion.getState().trabajo!
  controlador = new AbortController()
  const signal = controlador.signal
  useImpresion.setState({ error: null, reintentarAlVolver: false, progreso: { etapa: 'conectando', porcentaje: 1 } })
  await guardar({ estado: 'modelo', error: undefined, idRemoto: undefined })
  mantenerPantalla(true)
  try {
    const { motor, aviso } = await elegirMotor()
    if (aviso) avisar(aviso, 'info')
    await guardar({ motor: motor.id, urlRemota: motor.id === 'local' ? ajustes().localUrl : undefined })
    const { glb, servicio } = await motor.imagenA3D(
      t.imagen!,
      {
        quitarFondo: true,
        detalle: motor.id === 'local' ? 'detallado' : ajustes().detalleNube,
        signal,
        alCrearTrabajo: (idRemoto) => guardar({ idRemoto }),
      },
      alProgresar,
    )
    await terminar(glb, servicio)
  } catch (e) {
    fallo(e)
  }
}

async function terminar(glb: Blob, servicio: string) {
  const t = useImpresion.getState().trabajo!
  alProgresar({ etapa: 'texturas', porcentaje: 98, servicio, detalle: 'Guardando en la biblioteca' })
  const { renderizarMiniatura } = await import('../lib/escena')
  const miniatura = await renderizarMiniatura(glb)
    .then((c) => crearMiniatura(c))
    .catch(() => crearMiniatura(t.imagen!))
  const ahora = Date.now()
  const modeloId = nuevoId()
  await db.modelos.add({
    id: modeloId,
    nombre: t.nombre,
    carpetaId: t.carpetaId,
    creado: ahora,
    actualizado: ahora,
    origen: t.origen,
    prompt: t.prompt,
    estilo: t.estilo,
    colores: t.colores,
    imagen: t.imagen!,
    glb,
    miniatura,
    servicio,
    bytes: glb.size + t.imagen!.size + miniatura.size,
  })
  await guardar({ estado: 'listo', modeloId })
  useImpresion.setState({ progreso: { etapa: 'listo', porcentaje: 100, servicio } })
  mantenerPantalla(false)
  notificar('¡Tu modelo 3D está listo! 🎉', `«${t.nombre}» ya está en tu biblioteca.`, `#/modelo/${modeloId}`)
}

// ── API pública ─────────────────────────────────────────────

function nuevoTrabajo(datos: Omit<Trabajo, 'id' | 'creado' | 'estado' | 'motor'>): Trabajo {
  return { id: nuevoId(), creado: Date.now(), estado: 'modelo', motor: 'nube', ...datos }
}

export async function imprimirFoto(foto: Blob, opciones: { nombre: string; carpetaId: string; fondoEnNavegador: boolean }) {
  const { ahorroDatos } = ajustes()
  useImpresion.setState({ error: null, progreso: { etapa: 'analizando', porcentaje: 1, detalle: 'Preparando la foto' } })
  let imagen = await comprimirImagen(foto, ahorroDatos)
  if (opciones.fondoEnNavegador) {
    try {
      const { quitarFondoEnNavegador } = await import('../lib/quitarFondo')
      imagen = await quitarFondoEnNavegador(imagen, (p) =>
        alProgresar({ etapa: 'analizando', porcentaje: Math.min(6, 1 + p / 20), detalle: 'Quitando el fondo en tu móvil' }),
      )
    } catch (e) {
      console.warn('No se pudo quitar el fondo en el navegador', e)
      avisar('No se pudo quitar el fondo en el móvil; lo hará el servidor.', 'info')
    }
  }
  const t = nuevoTrabajo({ origen: 'foto', nombre: opciones.nombre, carpetaId: opciones.carpetaId, imagen })
  useImpresion.setState({ trabajo: t })
  await db.trabajos.put(t)
  await paso3D()
}

export async function imprimirTexto(opciones: { texto: string; estilo: Estilo; colores?: string; carpetaId: string }) {
  const t = nuevoTrabajo({
    origen: 'texto',
    prompt: opciones.texto.trim(),
    estilo: opciones.estilo,
    colores: opciones.colores?.trim() || undefined,
    nombre: nombreDesdeTexto(opciones.texto),
    carpetaId: opciones.carpetaId,
  })
  useImpresion.setState({ trabajo: t })
  await db.trabajos.put(t)
  await pasoImagenDesdeTexto()
}

export const aceptarImagen = () => paso3D()
export const regenerarImagen = () => pasoImagenDesdeTexto()

export function reintentar() {
  const t = useImpresion.getState().trabajo
  if (!t) return
  if (t.origen === 'texto' && !t.imagen) return pasoImagenDesdeTexto()
  return paso3D()
}

export function cancelar() {
  controlador?.abort()
  controlador = null
  mantenerPantalla(false)
  const t = useImpresion.getState().trabajo
  if (t) db.trabajos.delete(t.id)
  useImpresion.setState({ trabajo: null, progreso: null, error: null, reintentarAlVolver: false })
}

/** Cierra un trabajo terminado (o con error) y deja la impresora libre. */
export function descartar() {
  const t = useImpresion.getState().trabajo
  if (t) db.trabajos.delete(t.id)
  useImpresion.setState({ trabajo: null, progreso: null, error: null, reintentarAlVolver: false })
}

/**
 * Al abrir la app: retoma el último trabajo pendiente.
 * Si era del servidor local y tiene ID, se sigue consultando; si era de la nube, se reintenta.
 */
export async function retomarPendiente() {
  const pendientes = await db.trabajos.orderBy('creado').reverse().toArray()
  const t = pendientes.find((x) => x.estado !== 'listo')
  // Limpieza de trabajos antiguos ya terminados.
  await db.trabajos.where('estado').equals('listo').delete()
  if (!t) return
  // Un error de otra sesión no se vuelve a enseñar: se empieza limpio.
  if (t.estado === 'error') {
    await db.trabajos.delete(t.id)
    return
  }
  useImpresion.setState({ trabajo: t })
  if (t.estado === 'aprobar') return
  if (t.estado === 'modelo' && t.motor === 'local' && t.idRemoto) {
    controlador = new AbortController()
    avisar('Recuperando tu impresión del servidor…', 'info')
    try {
      const glb = await esperarTrabajo(t.idRemoto, alProgresar, 'Mi servidor', controlador.signal)
      await terminar(glb, 'Mi servidor')
    } catch (e) {
      fallo(e)
    }
    return
  }
  if (t.estado === 'imagen') return pasoImagenDesdeTexto()
  if (t.estado === 'modelo' || t.estado === 'interrumpido') {
    avisar('La impresión se interrumpió al cerrar la app. La retomamos… 🔄', 'info')
    return paso3D()
  }
}

/** Reintento automático al volver a la app tras un corte en segundo plano. */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && useImpresion.getState().reintentarAlVolver) {
    avisar('Se cortó la conexión mientras el móvil estaba bloqueado. Reintentando… 🔄', 'info')
    paso3D()
  }
})

