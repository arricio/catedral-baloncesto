/**
 * Instalación de la PWA:
 *  - Android/Chrome/Edge: se guarda el evento «beforeinstallprompt» para mostrar
 *    nuestro propio botón «Instalar app».
 *  - iPhone/iPad (Safari): no existe ese evento; se explican los pasos
 *    «Compartir → Añadir a pantalla de inicio».
 */
import { create } from 'zustand'
import { esAppInstalada } from './plataforma'

interface EventoInstalar extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export const useInstalar = create<{ evento: EventoInstalar | null; instalada: boolean }>(() => ({
  evento: null,
  instalada: esAppInstalada(),
}))

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  useInstalar.setState({ evento: e as EventoInstalar })
})
window.addEventListener('appinstalled', () => useInstalar.setState({ evento: null, instalada: true }))

export async function instalarApp(): Promise<boolean> {
  const { evento } = useInstalar.getState()
  if (!evento) return false
  await evento.prompt()
  const { outcome } = await evento.userChoice
  useInstalar.setState({ evento: null, instalada: outcome === 'accepted' })
  return outcome === 'accepted'
}
