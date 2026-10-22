/** Avisos breves (toasts) en pantalla. */
import { create } from 'zustand'

export type TipoAviso = 'info' | 'exito' | 'error'
export interface Aviso {
  id: number
  texto: string
  tipo: TipoAviso
}

export const useAvisos = create<{ lista: Aviso[] }>(() => ({ lista: [] }))
let siguiente = 1

export function avisar(texto: string, tipo: TipoAviso = 'info', ms = 4500) {
  const id = siguiente++
  useAvisos.setState((s) => ({ lista: [...s.lista.filter((a) => a.texto !== texto), { id, texto, tipo }] }))
  setTimeout(() => useAvisos.setState((s) => ({ lista: s.lista.filter((a) => a.id !== id) })), ms)
}
