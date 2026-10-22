/**
 * Sincronización OPCIONAL entre dispositivos con Supabase (plan gratuito).
 * - Cuentas por email (enlace mágico) o Google.
 * - Estrategia sencilla "gana el más reciente" por modelo y carpeta.
 * - Muestra el espacio usado frente al límite gratuito (1 GB de archivos).
 * Si no se configuran VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY, todo esto se oculta.
 */
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { create } from 'zustand'
import { CONFIG } from '../lib/config'
import { db, type Modelo } from '../lib/db'

export const syncDisponible = () => !!(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey)

const CUBO = 'impresora3d'
const CLAVE_BORRADOS = 'impresora3d-borrados-pendientes'

let cliente: Promise<SupabaseClient> | null = null
async function sb(): Promise<SupabaseClient> {
  cliente ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
      auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, storageKey: 'impresora3d-supabase' },
    }),
  )
  return cliente
}

interface EstadoSync {
  usuario: User | null
  sincronizando: boolean
  ultima: number
  bytesNube: number
  error: string
}
export const useSync = create<EstadoSync>(() => ({ usuario: null, sincronizando: false, ultima: 0, bytesNube: 0, error: '' }))

const urlVuelta = () => `${location.origin}${location.pathname}`

export async function iniciarConEmail(email: string) {
  const s = await sb()
  sessionStorage.setItem('oauth-origen', 'supabase')
  const { error } = await s.auth.signInWithOtp({ email, options: { emailRedirectTo: urlVuelta() } })
  if (error) throw new Error(error.message)
}

export async function iniciarConGoogle() {
  const s = await sb()
  sessionStorage.setItem('oauth-origen', 'supabase')
  const { error } = await s.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: urlVuelta() } })
  if (error) throw new Error(error.message)
}

export async function cerrarSesionSync() {
  await (await sb()).auth.signOut()
  useSync.setState({ usuario: null, bytesNube: 0 })
}

/** Al arrancar: recupera la sesión o procesa la vuelta del enlace de acceso. */
export async function iniciarSync(): Promise<void> {
  if (!syncDisponible()) return
  const s = await sb()
  const params = new URLSearchParams(location.search)
  if (params.has('code') && sessionStorage.getItem('oauth-origen') === 'supabase') {
    sessionStorage.removeItem('oauth-origen')
    await s.auth.exchangeCodeForSession(params.get('code')!).catch((e) => useSync.setState({ error: String(e.message ?? e) }))
    history.replaceState(null, '', `${location.pathname}#/ajustes`)
  }
  const { data } = await s.auth.getUser()
  useSync.setState({ usuario: data.user ?? null })
  s.auth.onAuthStateChange((_e, sesion) => useSync.setState({ usuario: sesion?.user ?? null }))
}

/** Apunta un modelo borrado para borrarlo también en la nube en la próxima sincronización. */
export function apuntarBorrado(id: string) {
  if (!useSync.getState().usuario) return
  const lista = new Set<string>(JSON.parse(localStorage.getItem(CLAVE_BORRADOS) || '[]'))
  lista.add(id)
  localStorage.setItem(CLAVE_BORRADOS, JSON.stringify([...lista]))
}

const ruta = (uid: string, id: string, archivo: string) => `${uid}/${id}/${archivo}`

export async function sincronizar(): Promise<{ subidos: number; bajados: number }> {
  const { usuario } = useSync.getState()
  if (!usuario) throw new Error('Inicia sesión para sincronizar.')
  const s = await sb()
  const uid = usuario.id
  useSync.setState({ sincronizando: true, error: '' })
  let subidos = 0
  let bajados = 0
  try {
    // 1) Borrados pendientes
    const borrados: string[] = JSON.parse(localStorage.getItem(CLAVE_BORRADOS) || '[]')
    for (const id of borrados) {
      await s.storage.from(CUBO).remove(['modelo.glb', 'original', 'miniatura'].map((a) => ruta(uid, id, a)))
      await s.from('modelos').delete().eq('id', id)
    }
    localStorage.removeItem(CLAVE_BORRADOS)

    // 2) Carpetas (en ambos sentidos)
    const carpetasLocales = await db.carpetas.toArray()
    const { data: carpetasNube, error: e1 } = await s.from('carpetas').select('id,nombre,creado,actualizado')
    if (e1) throw e1
    const mapaNube = new Map(carpetasNube!.map((c) => [c.id, c]))
    const subirCarpetas = carpetasLocales.filter((c) => (mapaNube.get(c.id)?.actualizado ?? -1) < c.actualizado)
    if (subirCarpetas.length) {
      const { error } = await s.from('carpetas').upsert(subirCarpetas.map((c) => ({ ...c, user_id: uid })))
      if (error) throw error
    }
    for (const c of carpetasNube!) {
      const local = carpetasLocales.find((x) => x.id === c.id)
      if (!local || local.actualizado < c.actualizado) await db.carpetas.put(c)
    }

    // 3) Modelos
    const { data: filas, error: e2 } = await s.from('modelos').select('id,carpeta_id,datos,bytes,creado,actualizado')
    if (e2) throw e2
    const nube = new Map(filas!.map((f) => [f.id as string, f]))
    const locales = await db.modelos.toArray()

    for (const m of locales) {
      const remoto = nube.get(m.id)
      if (remoto && remoto.actualizado >= m.actualizado) continue
      const subir = async (archivo: string, blob: Blob) => {
        const { error } = await s.storage.from(CUBO).upload(ruta(uid, m.id, archivo), blob, { upsert: true, contentType: blob.type || 'application/octet-stream' })
        if (error) throw error
      }
      if (!remoto) {
        await subir('modelo.glb', m.glb)
        await subir('original', m.imagen)
        await subir('miniatura', m.miniatura)
      }
      const { imagen: _i, glb: _g, miniatura: _m, ...datos } = m
      const { error } = await s.from('modelos').upsert({ id: m.id, user_id: uid, carpeta_id: m.carpetaId, datos, bytes: m.bytes, creado: m.creado, actualizado: m.actualizado })
      if (error) throw error
      await db.modelos.update(m.id, { sincronizado: m.actualizado })
      subidos++
    }

    for (const [id, f] of nube) {
      const local = locales.find((x) => x.id === id)
      if (local && local.actualizado >= f.actualizado) continue
      const datos = f.datos as Omit<Modelo, 'imagen' | 'glb' | 'miniatura'>
      if (local) {
        await db.modelos.update(id, { ...datos, carpetaId: f.carpeta_id, sincronizado: f.actualizado })
      } else {
        const bajar = async (archivo: string) => {
          const { data, error } = await s.storage.from(CUBO).download(ruta(uid, id, archivo))
          if (error) throw error
          return data
        }
        await db.modelos.put({ ...datos, id, carpetaId: f.carpeta_id, glb: await bajar('modelo.glb'), imagen: await bajar('original'), miniatura: await bajar('miniatura'), sincronizado: f.actualizado })
      }
      bajados++
    }

    const { data: total } = await s.from('modelos').select('bytes')
    useSync.setState({ ultima: Date.now(), bytesNube: (total ?? []).reduce((a, b) => a + Number(b.bytes), 0) })
    return { subidos, bajados }
  } catch (e) {
    const msg = (e as { message?: string }).message ?? String(e)
    useSync.setState({ error: msg })
    throw new Error(/exceed|quota|limit/i.test(msg) ? 'Has llegado al límite gratuito de Supabase (1 GB). Borra modelos antiguos.' : `No se pudo sincronizar: ${msg}`)
  } finally {
    useSync.setState({ sincronizando: false })
  }
}
