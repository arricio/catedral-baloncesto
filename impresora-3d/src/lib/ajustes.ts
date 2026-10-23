/**
 * Ajustes del usuario, guardados en el propio dispositivo (localStorage).
 * El token de Hugging Face y la contraseña del servidor local se quedan
 * SOLO en este dispositivo; nunca se envían a terceros.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CONFIG } from './config'

export type ModoMotor = 'auto' | 'nube' | 'local'
export type FondoVisor = 'oscuro' | 'claro' | 'degradado' | 'transparente'
export type Calidad = 'auto' | 'baja' | 'media' | 'alta'
export type QuitarFondo = 'servidor' | 'navegador'

export interface Ajustes {
  motor: ModoMotor
  localUrl: string
  localClave: string
  hfToken: string
  hfUsuario: string
  hfAvatar: string
  ahorroDatos: boolean
  tema: 'oscuro' | 'claro'
  fondoVisor: FondoVisor
  giroAuto: boolean
  quitarFondo: QuitarFondo
  maxMB: number
  calidad: Calidad
  /** Calidad de generación en la nube: rápida (menos cupo) o detallada. */
  detalleNube: 'rapido' | 'detallado'
  bienvenidaVista: boolean
  /** Sonido de la impresora mientras trabaja. */
  sonido: boolean
  /** Letra más grande para ver mejor. */
  letraGrande: boolean
  notificaciones: boolean
  syncActiva: boolean
  set: (parcial: Partial<Omit<Ajustes, 'set'>>) => void
}

export const useAjustes = create<Ajustes>()(
  persist(
    (set) => ({
      motor: 'auto',
      localUrl: '',
      localClave: '',
      hfToken: '',
      hfUsuario: '',
      hfAvatar: '',
      ahorroDatos: false,
      tema: 'oscuro',
      fondoVisor: 'degradado',
      giroAuto: true,
      quitarFondo: 'servidor',
      maxMB: CONFIG.maxImagenMB,
      calidad: 'auto',
      detalleNube: 'detallado',
      bienvenidaVista: false,
      letraGrande: false,
      sonido: true,
      notificaciones: false,
      syncActiva: false,
      set: (parcial) => set(parcial),
    }),
    {
      name: 'impresora3d-ajustes',
      version: 2,
      // v2: la calidad «Detallada» pasa a ser la de serie (los modelos se parecen más a la foto).
      migrate: (estado, version) => {
        const e = (estado ?? {}) as Partial<Ajustes>
        if (version < 2) e.detalleNube = 'detallado'
        return e as Ajustes
      },
    },
  ),
)

/** Acceso a los ajustes fuera de React. */
export const ajustes = () => useAjustes.getState()
