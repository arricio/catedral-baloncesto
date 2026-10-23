/**
 * Base de datos local (IndexedDB a través de Dexie).
 * Todo se guarda en el propio dispositivo, así la biblioteca funciona sin conexión.
 */
import Dexie, { type EntityTable } from 'dexie'

export const ID_CARPETA_DEFECTO = 'mis-impresiones'

export type Origen = 'texto' | 'foto'
export type Estilo = 'realista' | 'dibujos' | 'lowpoly' | 'juguete' | 'escultura'

export interface Carpeta {
  id: string
  nombre: string
  creado: number
  actualizado: number
}

export interface Modelo {
  id: string
  nombre: string
  carpetaId: string
  creado: number
  actualizado: number
  origen: Origen
  /** Texto original (si el origen es "texto"). */
  prompt?: string
  estilo?: Estilo
  colores?: string
  /** Foto original o imagen intermedia generada desde el texto. */
  imagen: Blob
  /** Modelo 3D en GLB (con texturas). */
  glb: Blob
  miniatura: Blob
  /** Servicio que lo generó (p. ej. "TRELLIS.2 · Nube"). */
  servicio?: string
  bytes: number
  /** Marca de sincronización con Supabase. */
  sincronizado?: number
}

export type EstadoTrabajo =
  | 'imagen' // generando la imagen desde el texto
  | 'aprobar' // esperando que el usuario acepte la imagen intermedia
  | 'modelo' // generando el modelo 3D
  | 'listo'
  | 'error'
  | 'interrumpido'

/** Trabajo en curso. Se guarda para poder retomarlo si se cierra la app. */
export interface Trabajo {
  id: string
  creado: number
  origen: Origen
  estado: EstadoTrabajo
  motor: 'nube' | 'local' | 'demo' | 'relieve'
  /** Opciones del «Retrato en relieve» (si se eligió ese modo). */
  relieve?: { volumen: number; peana: boolean; textoPeana?: string; fuente?: string }
  /** Tipo de letra para las palabras entre comillas (modo texto). */
  fuente?: string
  prompt?: string
  estilo?: Estilo
  colores?: string
  nombre: string
  carpetaId: string
  /** Imagen de partida (foto o imagen generada). */
  imagen?: Blob
  /** ID del trabajo en el servidor local (para retomarlo). */
  idRemoto?: string
  urlRemota?: string
  modeloId?: string
  error?: string
}

class BaseDatos extends Dexie {
  carpetas!: EntityTable<Carpeta, 'id'>
  modelos!: EntityTable<Modelo, 'id'>
  trabajos!: EntityTable<Trabajo, 'id'>

  constructor() {
    super('impresora3d')
    this.version(1).stores({
      carpetas: 'id, nombre, creado',
      modelos: 'id, carpetaId, creado, origen, nombre',
      trabajos: 'id, creado, estado',
    })
    // La carpeta "Mis impresiones" siempre existe.
    this.on('populate', (tx) => {
      const ahora = Date.now()
      tx.table('carpetas').add({ id: ID_CARPETA_DEFECTO, nombre: 'Mis impresiones', creado: ahora, actualizado: ahora })
    })
  }
}

export const db = new BaseDatos()

export const nuevoId = (): string =>
  (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`)

// ── Carpetas ────────────────────────────────────────────────

export async function crearCarpeta(nombre: string): Promise<string> {
  const id = nuevoId()
  const ahora = Date.now()
  await db.carpetas.add({ id, nombre: nombre.trim() || 'Carpeta nueva', creado: ahora, actualizado: ahora })
  return id
}

export async function renombrarCarpeta(id: string, nombre: string) {
  await db.carpetas.update(id, { nombre: nombre.trim(), actualizado: Date.now() })
}

/** Borra la carpeta. Sus modelos pasan a "Mis impresiones" salvo que se pida borrarlos. */
export async function borrarCarpeta(id: string, borrarModelos = false) {
  if (id === ID_CARPETA_DEFECTO) throw new Error('La carpeta «Mis impresiones» no se puede borrar.')
  await db.transaction('rw', db.carpetas, db.modelos, async () => {
    if (borrarModelos) await db.modelos.where('carpetaId').equals(id).delete()
    else await db.modelos.where('carpetaId').equals(id).modify({ carpetaId: ID_CARPETA_DEFECTO })
    await db.carpetas.delete(id)
  })
}

// ── Modelos ─────────────────────────────────────────────────

export async function moverModelo(id: string, carpetaId: string) {
  await db.modelos.update(id, { carpetaId, actualizado: Date.now() })
}

export async function renombrarModelo(id: string, nombre: string) {
  await db.modelos.update(id, { nombre: nombre.trim() || 'Sin nombre', actualizado: Date.now() })
}

export async function borrarModelo(id: string) {
  await db.modelos.delete(id)
}

/** Espacio aproximado usado por la biblioteca en este dispositivo. */
export async function espacioUsado(): Promise<{ usado: number; disponible?: number }> {
  if (navigator.storage?.estimate) {
    const e = await navigator.storage.estimate()
    return { usado: e.usage ?? 0, disponible: e.quota }
  }
  let usado = 0
  await db.modelos.each((m) => (usado += m.bytes))
  return { usado }
}

/** Pide al navegador que no borre los datos si falta espacio. */
export async function pedirAlmacenamientoPersistente() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist()
  } catch {
    /* no es crítico */
  }
}
