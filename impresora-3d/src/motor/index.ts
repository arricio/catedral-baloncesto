/**
 * Selección del motor: Automático (servidor local si está encendido; si no, nube),
 * Nube o Mi servidor. Comprueba el servidor local al arrancar y cada minuto.
 */
import { create } from 'zustand'
import { ajustes, useAjustes } from '../lib/ajustes'
import { comprobarServidor, motorLocal, type EstadoServidor } from './local'
import { motorNube } from './nube'
import { motorDemo } from './demo'
import type { Motor } from './tipos'

/** Modo demostración (pruebas): se activa con ?demo=1 en la URL. */
export const modoDemo = (() => {
  try {
    if (new URLSearchParams(location.search).has('demo')) sessionStorage.setItem('demo', '1')
    return sessionStorage.getItem('demo') === '1'
  } catch {
    return false
  }
})()

interface EstadoMotor {
  servidor: EstadoServidor | null
  comprobando: boolean
  ultimaComprobacion: number
}

export const useEstadoMotor = create<EstadoMotor>(() => ({ servidor: null, comprobando: false, ultimaComprobacion: 0 }))

export async function comprobarLocal(): Promise<EstadoServidor | null> {
  if (!ajustes().localUrl) {
    useEstadoMotor.setState({ servidor: null })
    return null
  }
  useEstadoMotor.setState({ comprobando: true })
  const servidor = await comprobarServidor()
  useEstadoMotor.setState({ servidor, comprobando: false, ultimaComprobacion: Date.now() })
  return servidor
}

/** Arranca la vigilancia del servidor local. */
export function vigilarServidorLocal() {
  comprobarLocal()
  const id = setInterval(() => !document.hidden && comprobarLocal(), 60_000)
  const alVolver = () => !document.hidden && comprobarLocal()
  document.addEventListener('visibilitychange', alVolver)
  useAjustes.subscribe((a, b) => a.localUrl !== b.localUrl && comprobarLocal())
  return () => {
    clearInterval(id)
    document.removeEventListener('visibilitychange', alVolver)
  }
}

/**
 * Devuelve el motor a usar ahora mismo.
 * Si el modo es "Mi servidor" pero está apagado, cambia a la nube (y lo indica).
 */
export async function elegirMotor(): Promise<{ motor: Motor; aviso?: string }> {
  if (modoDemo) return { motor: motorDemo }
  const { motor } = ajustes()
  if (motor === 'nube') return { motor: motorNube }
  const servidor = await comprobarLocal()
  if (servidor) return { motor: motorLocal }
  if (motor === 'local')
    return { motor: motorNube, aviso: 'Tu servidor local está apagado o no responde. Usamos la nube gratuita.' }
  return { motor: motorNube }
}

export const motorPorId = (id: Motor['id']): Motor => (id === 'local' ? motorLocal : id === 'demo' ? motorDemo : motorNube)
