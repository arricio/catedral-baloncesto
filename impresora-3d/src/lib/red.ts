/** Estado de la conexión: sin conexión, datos móviles o wifi. */
import { useEffect, useState } from 'react'

type InfoConexion = {
  type?: string
  effectiveType?: string
  saveData?: boolean
  addEventListener?: (t: string, f: () => void) => void
  removeEventListener?: (t: string, f: () => void) => void
}

const conexion = (): InfoConexion | undefined =>
  (navigator as Navigator & { connection?: InfoConexion }).connection

export interface EstadoRed {
  enLinea: boolean
  /** true si sabemos que se usa la red móvil (solo Android/Chrome lo informa). */
  datosMoviles: boolean
  /** El usuario ha activado el ahorro de datos en el sistema o la conexión es lenta. */
  lenta: boolean
}

export function leerEstadoRed(): EstadoRed {
  const c = conexion()
  return {
    enLinea: navigator.onLine,
    datosMoviles: c?.type === 'cellular',
    lenta: !!c?.saveData || c?.effectiveType === '2g' || c?.effectiveType === 'slow-2g' || c?.effectiveType === '3g',
  }
}

export function useEstadoRed(): EstadoRed {
  const [estado, setEstado] = useState(leerEstadoRed)
  useEffect(() => {
    const actualizar = () => setEstado(leerEstadoRed())
    window.addEventListener('online', actualizar)
    window.addEventListener('offline', actualizar)
    conexion()?.addEventListener?.('change', actualizar)
    return () => {
      window.removeEventListener('online', actualizar)
      window.removeEventListener('offline', actualizar)
      conexion()?.removeEventListener?.('change', actualizar)
    }
  }, [])
  return estado
}
