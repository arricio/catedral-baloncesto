/**
 * Enrutado mínimo por "hash" (#/imprimir, #/biblioteca, #/modelo/ID…).
 * Funciona en GitHub Pages sin configuración extra y sin conexión.
 */
import { useSyncExternalStore } from 'react'

export type Ruta =
  | { nombre: 'imprimir' }
  | { nombre: 'biblioteca'; carpeta?: string }
  | { nombre: 'modelo'; id: string }
  | { nombre: 'ajustes' }
  | { nombre: 'bienvenida' }
  | { nombre: 'conectar'; url: string; clave: string }

export function leerRuta(hash = location.hash): Ruta {
  const [ruta, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const partes = ruta.split('/').filter(Boolean)
  const q = new URLSearchParams(query)
  switch (partes[0]) {
    case 'biblioteca':
      return { nombre: 'biblioteca', carpeta: partes[1] }
    case 'modelo':
      return partes[1] ? { nombre: 'modelo', id: partes[1] } : { nombre: 'biblioteca' }
    case 'ajustes':
      return { nombre: 'ajustes' }
    case 'bienvenida':
      return { nombre: 'bienvenida' }
    case 'conectar':
      return { nombre: 'conectar', url: q.get('url') ?? '', clave: q.get('clave') ?? '' }
    default:
      return { nombre: 'imprimir' }
  }
}

const suscribir = (f: () => void) => {
  window.addEventListener('hashchange', f)
  return () => window.removeEventListener('hashchange', f)
}

export function useRuta(): Ruta {
  const hash = useSyncExternalStore(suscribir, () => location.hash)
  return leerRuta(hash)
}

export function ir(hash: string) {
  location.hash = hash.startsWith('#') ? hash : `#${hash}`
}
